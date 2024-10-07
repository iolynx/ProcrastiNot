'use strict';

import './popup.css';

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
    activatedStorage.get((activationStatus) => {
      let newStatus;
      let btnText;
      if (activationStatus == "Not Activated") {
        newStatus = "Activated";
        btnText = "Deactivate Monitoring";
        console.log(activationStatus);

      }
      else if (activationStatus == "Activated") {
        newStatus = "Not Activated";
        btnText = "Activate Monitoring";
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

  function updateTimer({ type }) {
    counterStorage.get((count) => {
      let newCount;

      if (type === 'INCREMENT') {
        newCount = count + 1;
      } else if (type === 'DECREMENT') {
        newCount = count - 1;
      } else {
        newCount = count;
      }

      counterStorage.set(newCount, () => {
        document.getElementById('counter').innerHTML = newCount;

        // Communicate with content script of
        // active tab by sending a message
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const tab = tabs[0];

          chrome.tabs.sendMessage(
            tab.id,
            {
              type: 'COUNT',
              payload: {
                count: newCount,
              },
            },
            (response) => {
              console.log('Current count value passed to contentScript file');
            }
          );
        });
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
    const minutesElement = document.getElementById('minutes');
    const secondsElement = document.getElementById('seconds');

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

    // Add event listeners for scrolling
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

    minutesElement.addEventListener('input', () => {
      let currentValue = parseInt(minutesElement.textContent, 10);
      console.log(currentValue, ' minutes');
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
      console.log(currentValue, ' seconds');
      if (isNaN(currentValue) || currentValue < 0) {
        secondsElement.textContent = '00';
      } else if (currentValue > 59) {
        secondsElement.textContent = '59';
      } else {
        secondsElement.textContent = convertToString(currentValue);
      }
      setCaretAtEnd(secondsElement);
    })
  })

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
        removeButton.innerHTML = 'x';
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
  
    // Load existing phrases from background on page load
    chrome.runtime.sendMessage({ type: 'getPhrases' }, (response) => {
      phrases = response.phrases || [];
      renderPhrases();
    });
  });

  
  // Communicate with background file by sending a message
  chrome.runtime.sendMessage(
    {
      type: 'GREETINGS',
      payload: {
        message: 'Hello, my name is Pop. I am from Popup.',
      },
    },
    (response) => {
      console.log("i have sex");
    }
  );
})();
