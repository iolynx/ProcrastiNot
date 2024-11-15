import * as tf from '@tensorflow/tfjs';
import * as use from '@tensorflow-models/universal-sentence-encoder';



let isFocusMode = false;
let model = null;
let focusPhrases = ['testing'];
let exDistractionPhrases = [];
let distractionExamples = [
    "entertainment news",
    "video",
    "funny",
    "social media post",
    "gaming news",
    "celebrities",
    "fashion",
    "trailer",
    "game",
    "gaming",
    "montage",
    "trending",
    "Troll",
    "valorant",
    "instagram",
    "facebook",
    "chess",
    "edit",
    "brainrot",
    "taylor swift"
];

chrome.runtime.onInstalled.addListener(async () => {
    console.log("Extension Installed");
    let isFocusMode = false;
    const startTime = performance.now();

    model = await use.load();
    
    const modelLoadTime = (performance.now() - startTime).toFixed();
    console.log("Model is Loaded");
    console.log("%cINFO:", "color:aquamarine", "Model Loading took", modelLoadTime, "ms.");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if(message.action == 'start-timer'){
        startCountdown(message.time);
    }
    else if(message.action == 'stop-timer'){
        stopCountdown();
    }
    else if(message.action == 'get-timer'){
        sendResponse({time : countdownTime});
    }
});



chrome.tabs.onActivated.addListener(async (activeInfo) => {

    //if focusmode is enabled, send a message to the current tab to check its rating

    const tab = await chrome.tabs.get(activeInfo.tabId);

    if (isFocusMode) {
        await chrome.scripting.executeScript({
            target: { tabId: activeInfo.tabId},
            files: ["contentScript.js"]
        });

        analyzeTab(tab, activeInfo.tabId);
    }
})


chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {

    await chrome.scripting.executeScript({
        target: { tabId: tabId},
        files: ["contentScript.js"]
    });

    if (changeInfo.status === 'complete' && tab.active && isFocusMode && tab.status === 'complete') {

        analyzeTab(tab, tabId);
    }
})


// chrome.webNavigation.onCompleted.addListener(async (activeInfo) => {
//     const tab = await chrome.tabs.get(activeInfo.tabId);
//     if (tab.active && isFocusMode) {
//         analyzeTab(tab, activeInfo.tabId);
//     }
// })



chrome.storage.onChanged.addListener((changes, namespace) => {
    let newVal = "";
    for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
        console.log(
            `Storage key "${key}" in namespace "${namespace}" changed.`,
            `Old value was "${oldValue}", new value is "${newValue}".`
        );

        newVal = newValue;
    }

    if (newVal == "Activated") {
        isFocusMode = true;
        checkActiveTabNow();
    }
    else {
        isFocusMode = false;
    }

});


// -------------------------- Timer Function --------------------------

let timerInterval = null;
let timerActive = false;
let countdownTime = {hours: 0, minutes: 10, seconds: 0};


function startCountdown(startTime){
    countdownTime = startTime;
    timerActive = true;
    runTimer();
}

function runTimer() {
    if (!timerActive) return;
  
    // Update time
    if (countdownTime.seconds > 0) {
      countdownTime.seconds--;
    } else if (countdownTime.minutes > 0) {
      countdownTime.seconds = 59;
      countdownTime.minutes--;
    } else if (countdownTime.hours > 0) {
      countdownTime.seconds = 59;
      countdownTime.minutes = 59;
      countdownTime.hours--;
    } else {
      // Timer finished
      timerActive = false;
      chrome.runtime.sendMessage({ action: 'timerFinished' });
      return;
    }
    
  // Send the updated time to popup.js or other parts of the extension
  chrome.runtime.sendMessage({
    action: 'update-timer',
    time: countdownTime
  });

  // Schedule the next tick
  setTimeout(runTimer, 1000); // Recursively call with 1-second delay
}


// function startCountdown(startTime) {
//     countdownTime = startTime;
//     if (timerInterval === null) {
//       timerInterval = setInterval(() => {
//         console.log(countdownTime);
//         if (countdownTime.seconds <= 0) {
//           if (countdownTime.minutes === 0) {
//             if(countdownTime.hours === 0){
//                 stopCountdown();
//                 return;
//             }
//             countdownTime.hours -= 1;
//             countdownTime.minutes = 59;
//           }
//           countdownTime.minutes -= 1;
//           countdownTime.seconds = 59;
//         } else {
//           countdownTime.seconds -= 1;
//         }
  
//         // Send the updated time to the popup
//         chrome.runtime.sendMessage({ action: 'update-timer', time: countdownTime });
//       }, 1000);
//     }
//   }

function stopCountdown() {
    // clearInterval(timerInterval);
    // timerInterval = null;

    // Notify popup that the timer has reset
    // chrome.runtime.sendMessage({ action: 'timer-reset', time: countdownTime });

    timerActive = false;
}

// -------------------------- Main Function --------------------------


async function checkActiveTabNow(){
    chrome.tabs.query({active: true, currentWindow: true}, async (tabs) =>{
        const activeTab = tabs[0];

        if(activeTab){
            console.log(`Checking  active tab: ${activeTab.title}, ID: ${activeTab.id}`);
            await chrome.scripting.executeScript({
                target: { tabId: activeTab.id},
                files: ["contentScript.js"]
            });
            analyzeTab(activeTab, activeTab.id);

        }
    })
}

async function analyzeTab(tab, tabId) {
    console.log(`Tab activated: ${tab.title} (ID: ${tab.id})`);


    chrome.tabs.sendMessage(tabId, { action: 'SENDINFO' }, async (response) => {
        if (chrome.runtime.lastError) {
            console.error(`Message error: ${chrome.runtime.lastError.message}`);
        } else {
            const pageTitle = response.title;
            const pageText = response.pageText;
            console.log(`We got a response from ${pageTitle}`);

            
            let startTime = performance.now();

            const textEmbeddings = await model.embed([pageText]);
            const titleEmbeddings = await model.embed([pageTitle]);

            const pageEmbeddingsTime = performance.now() - startTime;
            console.log("Page Embeddings created.");
            console.log("%cINFO:", "color:aquamarine", "Page embeddings took", pageEmbeddingsTime.toFixed(2), "ms.");

            let predictionStartTime = performance.now();
            const prediction = await analyzeEmbeddings(titleEmbeddings.arraySync()[0], textEmbeddings.arraySync()[0]);
            const predictionTime = performance.now() - predictionStartTime;

            console.log(`This tab is classified as ${prediction}`);
            console.log("%cINFO:", "color:aquamarine", "Prediction took", predictionTime.toFixed(2), "ms.");

            if(prediction === 'distraction'){
                chrome.tabs.remove(tabId);
            }
        }
    });
}

// to add and remove phrases 
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'addPhrase') {
      focusPhrases.push(message.phrase);
    
      const index = distractionExamples.indexOf(message.phrase);
      if(index !== -1){
        distractionExamples.splice(index, 1);
        exDistractionPhrases.push(message.phrase);
        // console.log(focusPhrases);
        // console.log(distractionExamples);
      }

      sendResponse({ success: true });
    }
    if (message.type === 'removePhrase') {
      focusPhrases = focusPhrases.filter(phrase => phrase !== message.phrase);
      const index = exDistractionPhrases.indexOf(message.phrase);
      if(index !== -1){
        distractionExamples.push(message.phrase);

        // console.log(focusPhrases);
        // console.log(distractionExamples);
      }
      sendResponse({ success: true });
    }
    if (message.type === 'getPhrases') {
      sendResponse({ phrases: focusPhrases });
    }
  });


// ------------------------- AI STUFF ---------------------------------


async function analyzeEmbeddings(titleEmbeddings, contentEmbeddings) {
    // Predefined focus and distraction phrases
    let originalFocusPhrases = [
        "work project",
        "study material",
        "coding assignment",
        "c++ project",
        "stackoverflow",
        "geeksforgeeks",
        "java",
        "programming",
        "c",
        "c++",
        "computer",
        "python",
        "github"
    ];



    // Combine any custom focus phrases with predefined ones
    let focusPhrasesFinal = focusPhrases.concat(originalFocusPhrases);

    // Generate embeddings for focus and distraction phrases
    const focusEmbeddings = await Promise.all(focusPhrasesFinal.map(async (text) => await embedText(text)));
    const distractionEmbeddings = await Promise.all(distractionExamples.map(async (text) => await embedText(text)));

    // Calculate maximum similarity for both title and content embeddings
    const maxFocusSimilarityTitle = maxSimilarity(titleEmbeddings, focusEmbeddings);
    const maxDistractionSimilarityTitle = averageSimilarity(titleEmbeddings, distractionEmbeddings);
    const maxFocusSimilarityContent = maxSimilarity(contentEmbeddings, focusEmbeddings);

    console.log("%cINFO:", "color:aquamarine");
    console.log("Max Focus Score (Title): ", maxFocusSimilarityTitle, 
                "Max Focus Score (Content): ", maxFocusSimilarityContent, 
                "Max Distraction Score: ", maxDistractionSimilarityTitle);

    // Logic to determine focus or distraction
    if (maxDistractionSimilarityTitle >= 0.35) {
        return "distraction";
    }

    if (maxFocusSimilarityTitle > 0.46 || maxFocusSimilarityContent > 0.46) {
        return "focus";
    }

    return "distraction";

}

async function analyzeEmbeddingsAvg(titleEmbeddings, contentEmbeddings) {
    // Predefined embeddings for focus and distraction categories
    let originalFocusPhrases = [
        "work project",
        "study material",
        "coding assignment",
        "c++ project",
        "stackoverflow",
        "geeksforgeeks",
        "java",
        "programming",
        "c",
        "c++",
        "computer",
        "python",
        "github"
    ];

    const distractionExamples = [
        "entertainment news",
        "video",
        "funny",
        "social media post",
        "gaming news",
        "celebrities",
        "fashion",
        "trailer",
        "game",
        "gaming",
        "montage",
        "trending",
        "Troll",
        "valorant",
        "instagram",
        "facebook",
        "chess",
        "edit",
        "brainrot",
        "taylor swift"
    ];

    // Generate embeddings for the predefined examples
    let focusPhrasesFinal = focusPhrases.concat(originalFocusPhrases);
    console.log(focusPhrasesFinal);
    const focusEmbeddings = await Promise.all(focusPhrasesFinal.map(async (text) => await embedText(text)));
    console.log(focusEmbeddings);
    const distractionEmbeddings = await Promise.all(distractionExamples.map(async (text) => await embedText(text)));

    // Calculate average similarity between the tab's embedding and the focus/distraction categories

    const focusScore = averageSimilarity(titleEmbeddings, focusEmbeddings);
    const distractionScore = averageSimilarity(titleEmbeddings, distractionEmbeddings);
    // const distractionScore = 1 - focusScore;
    const focusScore2 = averageSimilarity(contentEmbeddings, focusEmbeddings);

    console.log("Focus Score (Title): ", focusScore, "Focus Score (Content): ", focusScore2, "Distraction Score: ", distractionScore);

    // Decide based on threshold
    // return focusScore > distractionScore ? "focus" : "distraction";
    if(distractionScore > 0.3){
        return "distraction";
    }

    if((focusScore > 0.28 && focusScore2 > 0.24)){
        return "focus";
    }
    return "distraction";
}

// Function to generate embeddings using the Universal Sentence Encoder
async function embedText(text) {
    const embeddings = await model.embed([text]);
    return embeddings.arraySync()[0];
}

// Function to calculate the cosine similarity between two embeddings
function cosineSimilarity(vecA, vecB) {
    const dotProduct = vecA.reduce((sum, val, i) => sum + val * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, val) => sum + val * val, 0));

    if (magnitudeA && magnitudeB) {
        return dotProduct / (magnitudeA * magnitudeB);
    } else {
        return 0;
    }
}

// Calculate average cosine similarity between one embedding and an array of example embeddings
function averageSimilarity(embedding, exampleEmbeddings) {
    const similarities = exampleEmbeddings.map(example => cosineSimilarity(embedding, example));
    return similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length;
}

// Function to calculate the maximum similarity between the embeddings
function maxSimilarity(tabEmbedding, exampleEmbeddings) {
    let maxSimilarity = 0;
    
    exampleEmbeddings.forEach((exampleEmbedding) => {
        const similarity = cosineSimilarity(tabEmbedding, exampleEmbedding);
        if (similarity > maxSimilarity) {
            maxSimilarity = similarity;
        }
    });

    return maxSimilarity;
}
