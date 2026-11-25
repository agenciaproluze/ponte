// Blog público: aviso de cookies e carregamento dos anúncios do Google somente após o aceite.
(function () {
  var meta = document.querySelector('meta[name="google-adsense-account"]');
  var cliente = meta ? meta.content : null;

  function carregarAnuncios() {
    if (!cliente) return;
    var s = document.createElement('script');
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(cliente);
    document.head.appendChild(s);
    document.querySelectorAll('ins.adsbygoogle').forEach(function () {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    });
  }

  var aviso = document.getElementById('ck');
  if (localStorage.getItem('ck')) {
    if (aviso) aviso.remove();
    carregarAnuncios();
  } else if (aviso) {
    var botao = document.getElementById('ck-aceitar');
    if (botao) botao.addEventListener('click', function () {
      localStorage.setItem('ck', '1');
      aviso.remove();
      carregarAnuncios();
    });
  }
})();
