'use strict';

import './popup.css';


const hoursElement = document.getElementById('hours');
const minutesElement = document.getElementById('minutes');
const secondsElement = document.getElementById('seconds');




(function () {
  // We will make use of Storage API to get and store `count` value
  // More information on Storage API can we found at
  // https://developer.chrome.com/extensions/storage

  // To get storage access, we have to mention it in `permissions` property of manifest.json file
  // More information on Permissions can we found at
  // https://developer.chrome.com/extensions/declare_permissions
  const activatedStorage = {
    get: (cb) => {
      chrome.storage.sync.get(['activationStatus'], (result) => {
        cb(result.activationStatus);
      });
    },
    set: (value, cb) => {
      chrome.storage.sync.set(
        {
          activationStatus: value,
        },
        () => {
          cb();
        }
      );
    },
  };



  function setupActivation(initialValue = "Not Activated") {
    document.getElementById('activationStatus').innerHTML = initialValue;
    document.getElementById('activate').addEventListener('click', () => {
      updateActivation();
    });
  }

  function updateActivation() {
    let hoursVal = parseInt(hoursElement.textContent);
    let minutesVal = parseInt(minutesElement.textContent);
    let secondsVal = parseInt(secondsElement.textContent);
    activatedStorage.get((activationStatus) => {
      let newStatus;
      let btnText;
      if (activationStatus == "Not Activated") {
        newStatus = "Activated";
        btnText = "Deactivate Monitoring";
        console.log(activationStatus);
        chrome.runtime.sendMessage({action: 'start-timer', 
          time : {hours: hoursVal, minutes: minutesVal, seconds: secondsVal}
        });

      }
      else if (activationStatus == "Activated") {
        newStatus = "Not Activated";
        btnText = "Activate Monitoring";
        chrome.runtime.sendMessage({action: 'stop-timer'});

      }
      activatedStorage.set(newStatus, () => {
        document.getElementById('activationStatus').innerHTML = newStatus;
        document.getElementById('activate').innerHTML = btnText;

        // Communicate with content script of
        // active tab by sending a message
      });
    });

  }


  function setupTimer(initialValue = 0) {
    document.getElementById('counter').innerHTML = initialValue;

    document.getElementById('incrementBtn').addEventListener('click', () => {
      updateTimer({
        type: 'INCREMENT',
      });
    });

    document.getElementById('decrementBtn').addEventListener('click', () => {
      updateTimer({
        type: 'DECREMENT',
      });
    });
  }


  function restoreActivation() {
    // Restore count value
    activatedStorage.get((activationStatus) => {
      if (typeof activationStatus === "undefined") {
        // Set counter value as 0
        activatedStorage.set("Not Activated", () => {
          setupActivation("Not Activated");
        });
      } else {
        setupActivation(activationStatus);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', restoreActivation);
  document.addEventListener('DOMContentLoaded', () => {

    // get the initial state of the timer from background.js
    chrome.runtime.sendMessage({ action: 'get-timer' }, (response) => {
      if (response) {
        updateTimer(response.time);
      }
    });

    const hoursElement = document.getElementById('hours');
    const minutesElement = document.getElementById('minutes');
    const secondsElement = document.getElementById('seconds');

    const MAX_HOURS = 24;
    const MIN_HOURS = 0;
    const MIN_MINUTES = 0;
    const MAX_MINUTES = 59;
    const MAX_SECONDS = 30;
    const MIN_SECONDS = 0;

    function setCaretAtEnd(element) {
      const range = document.createRange();
      const selection = window.getSelection();
      range.selectNodeContents(element);
      range.collapse(false);  // Set the cursor to the end
      selection.removeAllRanges();
      selection.addRange(range);
    }    


    function convertToString(value) {
      return value.toString().padStart(2, '0');  // Always pad the string to 2 digits 
    }


    //function to update the timer values
    function updateTimer(time){
      hoursElement.textContent = convertToString(time.hours);
      minutesElement.textContent = convertToString(time.minutes);
      secondsElement.textContent = convertToString(time.seconds);
    }

    // Add event listeners for scrolling

    hoursElement.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = Math.sign(e.deltaY) === -1 ? 1 : -1;  // Scrolling up increases, down decreases
      let value = parseInt(hoursElement.textContent, 10);
      value += delta;
      if (value < MIN_HOURS) value = MAX_HOURS;
      if (value > MAX_HOURS) value = MIN_HOURS;

      hoursElement.textContent = value.toString().padStart(2, '0');
    });

    minutesElement.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = Math.sign(e.deltaY) === -1 ? 1 : -1;  // Scrolling up increases, down decreases
      let value = parseInt(minutesElement.textContent, 10);
      value += delta;
      if (value < MIN_MINUTES) value = MIN_MINUTES;
      if (value > MAX_MINUTES) value = MAX_MINUTES;

      minutesElement.textContent = value.toString().padStart(2, '0');
    });

    secondsElement.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = Math.sign(e.deltaY) === -1 ? 30 : -30;  // Scrolling up increases, down decreases
      let value = parseInt(secondsElement.textContent, 10);
      value += delta;
      if (value < MIN_SECONDS) value = MAX_SECONDS;
      if (value > MAX_SECONDS) value = MIN_SECONDS;

      secondsElement.textContent = value.toString().padStart(2, '0');
    });

    hoursElement.addEventListener('input', () => {
      let currentValue = parseInt(hoursElement.textContent, 10);
      if (isNaN(currentValue) || currentValue < 0) {
        hoursElement.textContent = '00';
      } else if (currentValue > 24) {
        hoursElement.textContent = '24';
      }
      else {
        hoursElement.textContent = convertToString(currentValue);
      }
      setCaretAtEnd(hoursElement);
    })

    minutesElement.addEventListener('input', () => {
      let currentValue = parseInt(minutesElement.textContent, 10);
      if (isNaN(currentValue) || currentValue < 0) {
        minutesElement.textContent = '00';
      } else if (currentValue > 59) {
        minutesElement.textContent = '59';
      }
      else {
        minutesElement.textContent = convertToString(currentValue);
      }
      setCaretAtEnd(minutesElement);
    })

    secondsElement.addEventListener('input', () => {
      let currentValue = parseInt(secondsElement.textContent, 10);
      if (isNaN(currentValue) || currentValue < 0) {
        secondsElement.textContent = '00';
      } else if (currentValue > 59) {
        secondsElement.textContent = '59';
      } else {
        secondsElement.textContent = convertToString(currentValue);
      }
      setCaretAtEnd(secondsElement);
    });

    // add listeners to update the timer
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action == 'update-timer'){
        updateTimer(message.time);
      }
    });

  })

  // add event listeners for the buttons to go to the settings page and back
  document.addEventListener('DOMContentLoaded', () => {
    const mainContent = document.getElementById('main-content');
    const settingsContent = document.getElementById('settings-content');
    const settingsBtn = document.getElementById('settings-button');
    const backBtn = document.getElementById('back-button');

    settingsBtn.addEventListener('click', () => {
      mainContent.style.display = 'none';
      settingsContent.style.display = 'block';
    });
  
    // Go back to the main page
    backBtn.addEventListener('click', () => {
      settingsContent.style.display = 'none';
      mainContent.style.display = 'block';
    });
  })


  // add event listeners for the buttons on the SETTINGS PAGE
  document.addEventListener('DOMContentLoaded', function () {
    const addButton = document.getElementById('add-phrase-button');
    const phraseInput = document.getElementById('focus-phrase-input');
    const addedPhrasesContainer = document.getElementById('added-phrases-container');
  
    // To store the phrases in the background
    let phrases = [];
  
    // Function to add a phrase
    function addPhrase(phrase) {
      phrases.push(phrase);
      chrome.runtime.sendMessage({ type: 'addPhrase', phrase });
      renderPhrases();
    }
  
    // Function to remove a phrase
    function removePhrase(phrase) {
      phrases = phrases.filter(p => p !== phrase);
      chrome.runtime.sendMessage({ type: 'removePhrase', phrase });
      renderPhrases();
    }
  
    // Function to render the phrases on the UI
    function renderPhrases() {
      addedPhrasesContainer.innerHTML = '';  // Clear the container
      phrases.forEach((phrase) => {
        const phraseBox = document.createElement('div');
        phraseBox.className = 'phrase-box';
        phraseBox.textContent = phrase;
  
        // Add remove button inside the phrase box
        const removeButton = document.createElement('button');
        removeButton.className = 'remove-button';
        removeButton.style='align-items: center;';
        removeButton.innerHTML = '<i class="fa-solid fa-x fa-xs"></i>';
        removeButton.onclick = () => removePhrase(phrase);
        
        phraseBox.appendChild(removeButton);
        addedPhrasesContainer.appendChild(phraseBox);
      });
    }
  
    // Add button click event listener
    addButton.addEventListener('click', () => {
      const phrase = phraseInput.value.trim();
      if (phrase) {
        addPhrase(phrase);
        phraseInput.value = '';  // Clear the input
      }
    });

    phraseInput.addEventListener("keydown", function(event) {
      if (event.key == "Enter"){
        // event.preventDefault();
        const phrase = phraseInput.value.trim();
        if(phrase){
          addPhrase(phrase);
          phraseInput.value = '';
          phraseInput.focus();
        }
      }
    });


  
    // Load existing phrases from background on page load
    chrome.runtime.sendMessage({ type: 'getPhrases' }, (response) => {
      phrases = response.phrases || [];
      renderPhrases();
    });


  });

  

})();





// Utility functions
function convertToString(value) {
  return value.toString().padStart(2, '0');  // Converts to a string and pads with 0
}

