if (!location.search) history.replaceState(null, '', '?robot=1');
if (new URLSearchParams(location.search).has('compare')) {
  import('./fork/compare').catch(error => { console.error(error); document.querySelector('#app')!.textContent='Comparison could not load. Reload to retry.'; });
} else if (new URLSearchParams(location.search).has('robot')) {
  import('./fork/robot-app').catch(error => { console.error(error); document.querySelector('#app')!.textContent='STREETWISE could not load. Reload to retry.'; });
} else if (new URLSearchParams(location.search).has('fork')) {
  import('./fork/app').catch(error => { console.error(error); document.querySelector('#app')!.textContent='STREETWISE could not load. Reload to try again.'; });
} else if (new URLSearchParams(location.search).has("legacy")) {
  Promise.all([
    import("maplibre-gl/dist/maplibre-gl.css"),
    import("./style.css"),
    import("./game"),
  ]).then(([, , { ChennaiGame }]) => new ChennaiGame());
} else {
  import("./survey").catch((error) => {
    console.error(error);
    const app = document.querySelector("#app");
    if (app) {
      app.replaceChildren();
      const message = document.createElement("p");
      message.textContent =
        "The 3D scene could not start. Please reload in a browser with WebGL enabled.";
      message.style.cssText =
        "padding:32px;font:16px Arial;color:#fff;background:#18211d";
      app.append(message);
    }
  });
}
