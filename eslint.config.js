const tsPlugin = require('@typescript-eslint/eslint-plugin')
const tsParser = require('@typescript-eslint/parser')
const prettierRecommended = require('eslint-plugin-prettier/recommended')

/** @type {import('eslint').Linter.Config[]} */
module.exports = [
    {
        ignores: ['dist/**', '**/*.d.ts'],
    },
    ...tsPlugin.configs['flat/recommended'],
    {
        files: ['src/**/*.ts'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                project: './tsconfig.json',
            },
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'error',
        },
    },
    prettierRecommended,
]
