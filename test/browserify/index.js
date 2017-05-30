var Esr = require('../../index');

// debug browser.
if (window) {
  window.Esr = Esr;
  var router = new Esr(Esr.BROWSER);
}

if (Esr) {
  document.getElementById("result").innerText ='Successful';
} else {
  document.getElementById("result").innerText ='Failure';
}
