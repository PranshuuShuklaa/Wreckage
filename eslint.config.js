import js from '@eslint/js'

export default [
  { ignores: ['dist/**', '.browser-profile/**'] },
  js.configs.recommended,
  { languageOptions: { globals: { chrome: 'readonly', console: 'readonly' } } },
]
