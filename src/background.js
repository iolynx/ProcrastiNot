'use strict';


import * as tf from '@tensorflow/tfjs';
import * as use from '@tensorflow-models/universal-sentence-encoder';



let isFocusMode = false;
let model = null;
let focusPhrases = ['testing'];

chrome.runtime.onInstalled.addListener(async () => {
    console.log("Extension Installed");
    let isFocusMode = false;
    model = await use.load();
    console.log("model is loaded");
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



// --------------------------- Main Func --------------------


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
            console.log(`we got a response from ${pageTitle}`);

            
            // let startTime = console.time();
            // console.log(pageText);
            const textEmbeddings = await model.embed([pageText]);
            const titleEmbeddings = await model.embed([pageTitle]);
            console.log("embeddings are embedded");
            const prediction = await analyzeEmbeddings(titleEmbeddings.arraySync()[0], textEmbeddings.arraySync()[0]);

            console.log(`This tab is classified as ${prediction}`);

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
      console.log(focusPhrases);
      sendResponse({ success: true });
    }
    if (message.type === 'removePhrase') {
      focusPhrases = focusPhrases.filter(phrase => phrase !== message.phrase);
      sendResponse({ success: true });
    }
    if (message.type === 'getPhrases') {
      sendResponse({ phrases: focusPhrases });
    }
  });


// ------------------------- AI STUFF ---------------------------------


async function analyzeEmbeddings(titleEmbeddings, contentEmbeddings) {
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
    if(focusScore > distractionScore || focusScore2 > 0.3 ){
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

