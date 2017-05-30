var esr = require('esr');

// debug browser.
if (window) {
  window.riot = esr;
}

if (esr) {
  document.getElementById("result").innerText ='Successful';
} else {
  document.getElementById("result").innerText ='Failure';
}
