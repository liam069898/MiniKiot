module.exports = {
    content: ['./index.html', './app.js', './app-*.js'],
    theme: {
        extend: {
            borderRadius: {
                none: '0',
                xs: '4px',
                sm: '5px',
                DEFAULT: '6px',
                md: '9px',
                lg: '10px',
                xl: '13px',
                '2xl': '20px',
                '3xl': '26px',
                '4xl': '32px',
                full: '9999px'
            },
            boxShadow: {
                'ios-card':
                    '0 4px 20px -2px rgba(0, 0, 0, .035),0 1px 2px 0 rgba(0, 0, 0, .02),inset 0 1px .5px rgba(255, 255, 255, .8)',
                'ios-modal':
                    '0 24px 60px -12px rgba(0, 0, 0, .22),0 8px 24px -4px rgba(0, 0, 0, .08),inset 0 1px 1px rgba(255, 255, 255, .9)',
                'ios-menu':
                    '0 14px 40px -4px rgba(0, 0, 0, .14),0 4px 12px -2px rgba(0, 0, 0, .06),inset 0 1px .5px rgba(255, 255, 255, .95)',
                'ios-btn':
                    '0 2px 8px -1px rgba(0, 102, 204, .32),inset 0 1px 1px rgba(255, 255, 255, .45)'
            },
            height: { 7.5: '30px' }
        }
    }
};
