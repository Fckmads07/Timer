// On récupère les 3 éléments <span> où on va afficher l'heure
let hours = document.getElementById("hours");
let minutes = document.getElementById("minutes");
let seconds = document.getElementById("seconds");

// Toutes les secondes (1000 ms = 1 seconde), on exécute ce code
setInterval(() => {
  // On crée un objet Date qui contient l'heure actuelle
  let currentTime = new Date();

  let hour = currentTime.getHours();
  let ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12; // Convert to 12-hour format

  hours.textContent = hour.toString().padStart(2, "0");
  minutes.textContent = currentTime.getMinutes().toString().padStart(2, "0");
  seconds.textContent = currentTime.getSeconds().toString().padStart(2, "0");
  document.getElementById("ampm").textContent = ampm; // New

  // Date in English/French format (toggle based on preference)
  let options = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  };
  let dateStr = currentTime.toLocaleDateString("en-CA", options); // English-Canadian
  // For French: currentTime.toLocaleDateString('fr-CA', options);
  document.getElementById("date").textContent = dateStr; // New
}, 1000); // ← répète toutes les 1000 millisecondes
