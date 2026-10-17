const backToTop = document.createElement('button');
backToTop.className = 'back-to-top';
backToTop.type = 'button';
backToTop.hidden = true;
backToTop.setAttribute('aria-label', '回到頂部');
backToTop.title = '回到頂部';
backToTop.innerHTML = '<span aria-hidden="true">↑</span>';
document.body.append(backToTop);

let returningToTop = false;
const updateBackToTop = () => {
  if (window.scrollY <= 1) returningToTop = false;
  backToTop.hidden = window.scrollY < 600 && !returningToTop;
};

window.addEventListener('scroll', updateBackToTop, { passive: true });
updateBackToTop();
backToTop.addEventListener('click', () => {
  returningToTop = true;
  window.scrollTo({
    top: 0,
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  });
});
