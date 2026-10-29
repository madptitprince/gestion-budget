'use strict';
document.querySelector('#login-form').addEventListener('submit',async e=>{
 e.preventDefault();const form=e.target,button=form.querySelector('button'),error=document.querySelector('#login-error');
 button.disabled=true;error.textContent='';
 try{const response=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:form.elements.password.value})});const result=await response.json();if(!response.ok)throw Error(result.error||'Connexion impossible.');location.replace('/');}
 catch(err){error.textContent=err.message;button.disabled=false;}
});
