const mirza = {
    changeTheme(theme = 'light') {        
        if (theme != 'light' && theme != 'dark') return;

        document.querySelector('html').setAttribute('data-theme', theme);
        try {
            localStorage.setItem('theme', theme);
        } catch (e) {}
    }
};

window.addEventListener('DOMContentLoaded', () => {
    const controller = document.querySelector('.theme-controller');
    if (!controller) return;

    // Keep the checkbox in sync with the theme applied before paint.
    controller.checked = document.documentElement.getAttribute('data-theme') === 'dark';

    controller.addEventListener('change', (el) => {
        const value = el.target.checked ? 'dark' : 'light';

        mirza.changeTheme(value);
    });
});