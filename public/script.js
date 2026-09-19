const mirza = {
    changeTheme(theme = 'light') {        
        if (theme != 'light' && theme != 'dark') return;

        console.log(theme);
        

        document.querySelector('html').setAttribute('data-theme', theme);
    }
};

window.addEventListener('DOMContentLoaded', () => {
    document.querySelector('.theme-controller').addEventListener('change', (el) => {
        const value = el.target.checked ? 'dark' : 'light';        

        mirza.changeTheme(value);
    });
});