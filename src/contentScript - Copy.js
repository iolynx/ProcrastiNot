'use strict';

// Content script file will run in the context of web page.
// With content script you can manipulate the web pages using
// Document Object Model (DOM).
// You can also pass information to the parent extension.

// We execute this script by making an entry in manifest.json file
// under `content_scripts` property

// For more information on Content Scripts,
// See https://developer.chrome.com/extensions/content_scripts

// Log `title` of current active web page

import * as tf from '@tensorflow/tfjs';



const pageTitle = document.head.getElementsByTagName('title')[0].innerHTML;
console.log(
  `Page title is: '${pageTitle}' - evaluated by Chrome extension's 'contentScript.js' file`
);


// Communicate with background file by sending a message
chrome.runtime.sendMessage(
  {
    type: 'GREETINGS',
    payload: {
      message: 'Hello, my name is Con. I am from ContentScript.',
    },
  },
  (response) => {
    console.log(response.message);
  }
);



chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'COUNT') {
    console.log(`Current count is ${request.payload.count}`);
  }

  // Send an empty response
  // See https://github.com/mozilla/webextension-polyfill/issues/130#issuecomment-531531890
  sendResponse({});
  return true;
});


// --------------- Embedding AI Logic ---------------------


async function loadUSEModel() {
  const modelUrl = chrome.runtime.getURL('models/universal-sentence-encoder/model.json');
  try {
    const model = await tf.loadGraphModel(modelUrl);
    return model;
  } catch (error) {
    console.error("Failed to load the model:", error);
    return null;
  }
}


async function analyzeEmbeddings(embeddings) {
  // Define some representative sentences for focus and distraction
  const focusSentences = [
    "working project.",
    "Studying exams.",
    "Reading article on productivity.",
    "tensorflow",
    "stack overflow"
  ];
  const distractionSentences = [
    "Watching funny cat videos.",
    "Browsing social media.",
    "Playing an online game.",
    "youtube",
    "reddit",
    "gaming"
  ];

  // Load the Universal Sentence Encoder model
  const model = await use.load();
  
  // Get embeddings for the focus and distraction sentences
  const focusEmbeddings = await model.embed(focusSentences);
  const distractionEmbeddings = await model.embed(distractionSentences);
  
  // Calculate the average embedding for both categories
  const avgFocusEmbedding = tf.mean(focusEmbeddings, 0);
  const avgDistractionEmbedding = tf.mean(distractionEmbeddings, 0);
  
  // Calculate cosine similarity with the tab's embeddings
  const tabEmbedding = embeddings.arraySync()[0]; // Get the embedding array for the current tab
  const focusSimilarity = tf.losses.cosineDistance(tabEmbedding, avgFocusEmbedding, 0).arraySync();
  const distractionSimilarity = tf.losses.cosineDistance(tabEmbedding, avgDistractionEmbedding, 0).arraySync();
  
  // Classify based on similarity
  return focusSimilarity < distractionSimilarity ? "focus" : "distraction";
}


async function oldanalyzeEmbeddings(embedding) {
  const focusPhrases = ["work project", "study material", "coding assignment"];
  const distractionExamples = ["entertainment news", "funny video", "social media post", "gaming news"];

  const focusEmbeddings = await Promise.all(focusPhrases.map(async (text) => await embedText(model, text)));
  const distractionEmbeddings = await Promise.all(distractionExamples.map(async (text) => await embedText(model, text)));

  const focusScore = averageSimilarity(embedding, focusEmbeddings);
  const distractionScore = averageSimilarity(embedding, distractionEmbeddings);

  return focusScore > distractionScore ? "focus" : "distraction";
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

// --------------------------------------------------------------------------------

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if(message.action === 'ANALYZETAB'){

    const pageTitle = document.title;
    const pageText = document.body.innerText;


    const model =  loadUSEModel();
    const embeddings = await model.execute({ input: tf.tensor([pageText]) }); 
    const prediction = await analyzeEmbeddings(embeddings);


    console.log(`This tab is classified as ${prediction}`);

    sendResponse({result: prediction});  //replace no with prediction
  }
});