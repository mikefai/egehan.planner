// App — bootstrap

(async function(){
  await loadStudentData();
  setupTabs();
  await init();
  renderAll();
})();
