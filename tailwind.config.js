/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                youtube: '#FF0000',
                instagram: '#E1306C',
                threads: '#000000',
            }
        },
    },
    plugins: [],
}
