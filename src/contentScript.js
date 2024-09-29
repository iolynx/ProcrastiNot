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
import * as use from '@tensorflow-models/universal-sentence-encoder';

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

// Listen for message
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if(message.action === 'ANALYZETAB'){

    const pageTitle = document.title;
    const pageText = document.body.innerText;


    const model = await use.load();
    console.log("Model is loaded");
    const embeddings = await model.embed([pageText]);
    console.log("embeddings are embedded");
    const prediction = await analyzeEmbeddings(embeddings.arraySync()[0]);


    console.log(`This tab is classified as ${prediction}`);

    sendResponse({result: prediction});  //replace no with prediction
  }
});


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

async function analyzeEmbeddings(embedding) {
  // Predefined embeddings for focus and distraction categories
  const focusExamples = [
    "work project", 
    "study material", 
    "coding assignment"
  ];

  const distractionExamples = [
    "entertainment news", 
    "funny video", 
    "social media post", 
    "gaming news",
    "celebrities",
    "fashion",
    "trailer"
  ];

  // Generate embeddings for the predefined examples
  const focusEmbeddings = await Promise.all(focusExamples.map(async (text) => await embedText(text)));
  const distractionEmbeddings = await Promise.all(distractionExamples.map(async (text) => await embedText(text)));

  // Calculate average similarity between the tab's embedding and the focus/distraction categories
  const focusScore = averageSimilarity(embedding, focusEmbeddings);
  const distractionScore = averageSimilarity(embedding, distractionEmbeddings);

  console.log("Focus Score: ", focusScore, "Distraction Score: ", distractionScore);

  // Decide based on threshold
  return focusScore > distractionScore ? "focus" : "distraction";
}

// Function to generate embeddings using the Universal Sentence Encoder
async function embedText(text) {
  const model = await use.load();  // Load the model
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

