(function () {
    var SB_URL = 'https://dzcopuuswwbxoyruwsnt.supabase.co';
    var SB_KEY = 'sb_publishable_suxhKFjAKF7Sy1UoxTM_Aw_v3AeK6q7';

    // Avoid double-tracking on same page load (e.g. script included twice)
    if (window._cityTracked) return;
    window._cityTracked = true;

    fetch('https://ipapi.co/json/')
        .then(function (r) { return r.json(); })
        .then(function (d) {
            if (!d.city) return;
            fetch(SB_URL + '/rest/v1/city_visits', {
                method: 'POST',
                headers: {
                    'apikey': SB_KEY,
                    'Authorization': 'Bearer ' + SB_KEY,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({ city: d.city, country_code: d.country_code })
            });
        })
        .catch(function () {});
})();
