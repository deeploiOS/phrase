module.exports = {
    extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
    rules: {
        '@typescript-eslint/no-explicit-any': 'error',
        'prettier/prettier': 'error',
    },
    parser: '@typescript-eslint/parser',
    parserOptions: {
        project: './tsconfig.json',
    },
    plugins: ['eslint-plugin-import', '@typescript-eslint', 'prettier'],
}
