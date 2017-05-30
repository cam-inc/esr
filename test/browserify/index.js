var esr = require('../../index');

// debug browser.
if (window) {
  window.esr = esr;
}

if (esr) {
  document.getElementById("result").innerText ='Successful';
} else {
  document.getElementById("result").innerText ='Failure';
}
