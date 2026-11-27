"""Build first with npm run build. Run with Python, Playwright and installed Chromium:
python -m playwright install chromium
python tests/edge_cases.py -v
Native shortcut test requires an interactive Windows desktop.
"""
import ctypes
import json
from pathlib import Path
import shutil
import sys
import tempfile
import time
import unittest

from playwright.sync_api import sync_playwright

WIKI = "https://en.wikipedia.org/wiki/Gravity"
GITHUB = "https://github.com/octocat/Hello-World"
GOV = "https://www.gov.uk/"
ACTIVE = 'div[popover="manual"]:has(> div[style*="cursor: grab"])'


class LiveExtension(unittest.TestCase):
    headed = False

    @classmethod
    def setUpClass(cls):
        tmp = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        cls.addClassCleanup(tmp.cleanup)
        extension = Path(tmp.name) / "extension"
        shutil.copytree(Path(__file__).resolve().parents[1] / "dist", extension)
        manifest = extension / "manifest.json"
        data = json.loads(manifest.read_text())
        # Let unattended tests inject without synthesizing an activeTab gesture.
        data["host_permissions"] = [url.split("/", 3)[0] + "//" + url.split("/")[2] + "/*"
                                    for url in (WIKI, GITHUB, GOV)]
        manifest.write_text(json.dumps(data))
        cls.pw = sync_playwright().start()
        cls.addClassCleanup(cls.pw.stop)
        cls.ctx = cls.pw.chromium.launch_persistent_context(
            str(Path(tmp.name) / "profile"), channel="chromium", headless=not cls.headed,
            args=[f"--disable-extensions-except={extension}", f"--load-extension={extension}"],
            viewport={"width": 1280, "height": 800})
        cls.addClassCleanup(cls.ctx.close)
        cls.worker = (cls.ctx.service_workers or [cls.ctx.wait_for_event("serviceworker")])[0]

    def visit(self, url=WIKI):
        self.page = self.ctx.new_page()
        self.addCleanup(self.page.close)
        result = self.page.goto(url, wait_until="domcontentloaded")
        self.assertTrue(result.ok, self.page.title())
        self.page.wait_for_load_state("load")
        self.page.evaluate("document.fonts.ready")
        self.page.bring_to_front()
        self.tab = self.worker.evaluate("(url)=>chrome.tabs.query({url}).then(t=>t[0].id)", self.page.url)
        return result

    def toggle(self):
        return self.worker.evaluate("""async id=>{
          await chrome.scripting.executeScript({target:{tabId:id},files:['src/content/index.js']});
          return chrome.tabs.sendMessage(id,{type:'WRECK_TOGGLE'},{frameId:0})
        }""", self.tab)

    def probe(self, html):
        # Deterministic markup on the live page for layout conditions absent from some visits.
        self.page.evaluate("""html=>{const box=document.createElement('div');
          box.id='qa';box.style='position:fixed;top:120px;left:10px;z-index:99999';
          box.insertAdjacentHTML('beforeend',html);document.body.prepend(box)}""", html)


class EdgeCases(LiveExtension):
    def test_header(self):
        self.visit()
        self.probe('<header style="position:fixed;top:0;left:0;width:500px;height:54px"><button>Menu</button></header>')
        h = self.page.locator("#qa header")
        self.assertTrue(self.toggle()["active"])
        self.assertEqual(h.evaluate("e=>e.style.willChange"), "transform")
        self.toggle()
        self.assertEqual(h.evaluate("e=>e.style.position"), "fixed")

    def test_large_dom(self):
        self.visit()
        self.assertGreater(self.page.locator("*").count(), 1000)
        self.probe('<div style="display:grid;grid-template-columns:repeat(20,48px)">' +
                   '<button style="width:48px;height:20px">item</button>' * 180 + '</div>')
        self.assertEqual(self.toggle()["bodyCount"], 150)
        self.assertEqual(self.toggle()["bodyCount"], 0)

    def test_static_media(self):
        self.visit()
        self.probe('<figure style="width:240px;margin:0"><iframe title="empty" width="60" height="50"></iframe>'
                   '<canvas width="60" height="50"></canvas><video width="60" height="50"></video></figure>')
        def positions():
            return [el.bounding_box() for el in self.page.locator("#qa iframe,#qa canvas,#qa video").all()]
        before = positions()
        self.toggle()
        self.page.wait_for_timeout(350)
        self.assertEqual(positions(), before)
        self.assertFalse(self.page.locator("#qa figure").evaluate(
            "e=>e.style.willChange==='transform' || e.style.opacity==='0'"))

    def test_trapped(self):
        self.visit()
        for css in ["transform:translateX(12px)", "filter:blur(0px)", "perspective:500px", "contain:paint"]:
            with self.subTest(css=css):
                self.probe(f'<div style="{css}"><button>Trapped item</button></div>')
                btn = self.page.get_by_role("button", name="Trapped item")
                before = btn.bounding_box()
                self.toggle()
                clone = self.page.locator('[popover] button[aria-hidden="true"]').filter(has_text="Trapped item")
                self.assertEqual(clone.count(), 1)
                self.assertEqual(self.page.locator("#qa button").evaluate("e=>e.style.opacity"), "0")
                self.toggle()
                self.assertEqual(btn.bounding_box(), before)
                self.page.locator("#qa").evaluate("e=>e.remove()")

    def test_text_block(self):
        self.visit()
        p = self.page.locator("p").filter(has_text="gravity").evaluate_all(
            "els=>els.find(e=>e.textContent.length>250 && e.offsetHeight>0).id='qa-paragraph'")
        self.page.locator("#"+p).scroll_into_view_if_needed()
        self.toggle()
        self.assertTrue(self.page.locator("#"+p).evaluate(
            "e=>e.style.willChange==='transform' && !e.querySelector('[style*=\"will-change: transform\"]')"))

    def test_scrolled(self):
        self.visit()
        self.page.wait_for_load_state("load")
        self.page.evaluate("document.fonts.ready")
        self.page.evaluate("scrollTo({top:3000,behavior:'instant'})")
        self.page.wait_for_timeout(650)
        y = self.page.evaluate("scrollY")
        self.assertGreater(y, 2000)
        self.page.evaluate("""window.offscreen=[...document.querySelectorAll('p,h1,h2,img')].filter(e=>{
          const r=e.getBoundingClientRect();return r.width && (r.bottom<0 || r.top>innerHeight)
        }).map(e=>[e,e.getAttribute('style')])""")
        self.toggle()
        self.assertTrue(self.page.evaluate("offscreen.length>0 && offscreen.every(([e,s])=>e.getAttribute('style')===s)"))
        self.toggle()
        self.assertEqual(self.page.evaluate("scrollY"), y)

    def test_rerender(self):
        self.visit(GITHUB)
        self.probe('<p style="color:blue">Before render</p>')
        self.toggle()
        self.page.evaluate("""window.old=document.querySelector('#qa p');
          const next=document.createElement('p');next.textContent='After render';old.replaceWith(next)""")
        self.toggle()
        self.assertTrue(self.page.evaluate("""!old.isConnected && old.getAttribute('style')==='color:blue'
          && document.querySelector('#qa').childElementCount===1 && document.querySelector('#qa p').textContent==='After render'"""))

    def test_csp(self):
        response = self.visit(GITHUB)
        self.assertIn("script-src", response.headers["content-security-policy"])
        self.assertGreater(self.toggle()["bodyCount"], 0)
        self.assertEqual(self.page.locator(ACTIVE).count(), 1)
        self.assertFalse(self.toggle()["active"])

    def test_restricted(self):
        popup = self.ctx.new_page()
        self.addCleanup(popup.close)
        target = self.ctx.new_page()
        self.addCleanup(target.close)
        for url in ["chrome://version", "https://chromewebstore.google.com/"]:
            with self.subTest(url=url):
                target.goto(url, wait_until="domcontentloaded")
                target.bring_to_front()
                popup.goto(self.worker.url.rsplit("/",1)[0]+"/src/popup/popup.html")
                self.assertEqual(popup.evaluate("chrome.tabs.query({active:true,currentWindow:true}).then(t=>t[0].id)"),
                                 self.worker.evaluate("chrome.tabs.query({active:true,lastFocusedWindow:true}).then(t=>t[0].id)"))
                self.assertTrue(target.evaluate("document.visibilityState==='visible'"))
                popup.locator("#notice").wait_for(state="visible")
                self.assertTrue(popup.locator("#toggle").is_disabled())
                self.assertIn("Can't run on this page", popup.locator("#notice").inner_text())

    def test_tabs(self):
        self.visit()
        self.toggle()
        other = self.ctx.new_page()
        self.addCleanup(other.close)
        other.goto(GITHUB, wait_until="domcontentloaded")
        other.bring_to_front()
        self.assertEqual(other.locator(ACTIVE).count(), 0)
        self.page.bring_to_front()
        self.assertEqual(self.page.locator(ACTIVE).count(), 1)
        self.assertFalse(self.toggle()["active"])

    def test_resize(self):
        self.visit()
        self.probe('<button style="position:fixed;left:1100px;top:650px">Resize probe</button>')
        self.toggle()
        self.page.set_viewport_size({"width":800,"height":500})
        self.page.wait_for_function("""[...document.querySelectorAll('button')].some(e=>
          e.textContent==='Resize probe' && e.style.transform.includes('scale(0.625)'))""")
        visual = self.page.locator("button[style*='will-change: transform']").filter(has_text="Resize probe")
        self.assertEqual(visual.count(),1)
        r=visual.bounding_box()
        self.assertTrue(0<r["x"]+r["width"]/2<800 and 0<r["y"]+r["height"]/2<500,r)
        self.page.set_viewport_size({"width":1280,"height":800})
        self.page.wait_for_function("""Array.from(document.querySelectorAll("button")).some(e=>e.textContent==="Resize probe" && e.style.transform.includes("scale(1)"))""")
        self.toggle()
        self.assertEqual(self.page.locator("#qa button").evaluate("e=>e.style.left"),"1100px")

    def test_cookie_header(self):
        self.visit(GOV)
        banner=self.page.locator(".govuk-cookie-banner:visible").first
        banner.wait_for(timeout=5000)
        header=self.page.locator("header:visible").first
        header.evaluate("e=>{e.style.position='sticky';e.style.top='0px'}")
        saved=[e.get_attribute("style") for e in [header,banner]]
        self.toggle()
        self.assertEqual(header.evaluate("e=>e.style.willChange"),"transform")
        self.assertFalse(self.toggle()["active"])
        self.assertEqual([e.get_attribute("style") for e in [header,banner]],saved)
        self.assertTrue(banner.is_visible())


class NativeShortcut(LiveExtension):
    headed = True

    @unittest.skipUnless(sys.platform=="win32", "native shortcut driver requires Windows")
    def test_double_hotkey(self):
        self.visit()
        u = ctypes.windll.user32
        title = "Wreckage shortcut test " + str(time.monotonic_ns())
        self.page.evaluate("title=>document.title=title", title)
        self.page.wait_for_timeout(150)
        handles = []

        @ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)
        def find(hwnd, _):
            buf = ctypes.create_unicode_buffer(512)
            u.GetWindowTextW(hwnd, buf, len(buf))
            if title in buf.value and u.IsWindowVisible(hwnd):
                handles.append(hwnd)
            return True

        u.EnumWindows(find, 0)
        self.assertTrue(handles)
        self.page.bring_to_front()
        u.SwitchToThisWindow(handles[0], True)
        u.SetForegroundWindow(handles[0])
        self.page.wait_for_timeout(200)
        if u.GetForegroundWindow() != handles[0]:
            self.skipTest("Windows did not give the test browser foreground keyboard focus")
        self.page.evaluate("""window.starts=0;new MutationObserver(ms=>{
          for(const m of ms) for(const n of m.addedNodes) if(n.popover==='manual') starts++
        }).observe(document.body,{childList:true})""")
        for _ in range(2):
            for key, flag in [(18,0),(71,0),(71,2),(18,2)]:
                u.keybd_event(key,0,flag,0)
            time.sleep(.06)
        self.page.wait_for_function("starts===1 && !document.querySelector('div[popover]:popover-open')",timeout=4000)


if __name__ == "__main__":
    unittest.main()
