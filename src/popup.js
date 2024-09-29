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



  function setupActivation(initialValue = "Not Activated"){
    document.getElementById('activationStatus').innerHTML = initialValue;
    document.getElementById('activate').addEventListener('click', () => {
      updateActivation();
    });
  }

  function updateActivation() {
    activatedStorage.get((activationStatus) => {
      let newStatus;
      let btnText;
      if (activationStatus == "Not Activated"){
        newStatus = "Activated";
        btnText = "Deactivate Monitoring";
        console.log(activationStatus);

      }
      else if (activationStatus == "Activated"){
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
