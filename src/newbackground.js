'use strict';


import * as tf from '@tensorflow/tfjs';
import * as use from '@tensorflow-models/universal-sentence-encoder';



let isFocusMode = false;
let model = null;

chrome.runtime.onInstalled.addListener(async () => {
  console.log("Extension Installed");
  let isFocusMode = false;
  // model = await use.load();
  model = await loadUSEModel();
  console.log("model is loaded");
  console.log(typeof model);
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GREETINGS') {
    const message = `Hi ${
      sender.tab ? 'Con' : 'Pop'
    }, my name is Bac. I am from Background. It's great to hear from you.`;

    // Log message coming from the `request` parameter
    console.log(request.payload.message);
    // Send a response message
    sendResponse({
      message,
    });
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {

  if(changeInfo.status === 'complete' && tab.active && isFocusMode){
    console.log(`Tab activated: ${tab.title} (ID: ${tab.id})`);

    await chrome.scripting.executeScript({
      target: {tabId: tabId},
      files: ["contentScript.js"]
    });

    chrome.tabs.sendMessage(tabId, { action: 'SENDINFO' }, async (response) => {
      if (chrome.runtime.lastError) {
        console.error(`Message error: ${chrome.runtime.lastError.message}`);
      } else {
        const pageTitle = response.title;
        const pageText = response.pageText;
        console.log(`we got a response from ${pageTitle}`);
        console.log("it says:");
        console.log(`${pageText}`);

        const embeddings = await embedText([pageText]);
        console.log("embeddings are embedded");
        const prediction = await analyzeEmbeddings(embeddings);

        console.log(`This tab is classified as ${prediction}`);

      }
    });
  }
})

chrome.storage.onChanged.addListener((changes, namespace) => {
  let newVal = "";
  for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
    console.log(
      `Storage key "${key}" in namespace "${namespace}" changed.`,
      `Old value was "${oldValue}", new value is "${newValue}".`
    );

    newVal = newValue;
  }

  if(newVal == "Activated"){
    isFocusMode = true;
  }
  else{
    isFocusMode = false;
  }
  
});


// ------------------------- AI STUFF ---------------------------------

async function loadUSEModel() {
  const model = await tf.loadGraphModel(
      chrome.runtime.getURL('models/universal-sentence-encoder/model.json')
  );
  return model;
}


async function analyzeEmbeddings(embedding) {
  // Predefined embeddings for focus and distraction categories
  const focusPhrases = [
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
  const focusEmbeddings = await Promise.all(focusPhrases.map(async (text) => await embedText(text)));
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
  if (!model) {
      model = await loadUSEModel();  // Ensure the model is loaded
  }
  
  const inputTensor = tf.tensor([text]); // Create a tensor from the input text
  const embeddings = await model.executeAsync([inputTensor]); // Use executeAsync to get embeddings

  // const embeddings = await model.embed([text]);
  return embeddings.arraySync()[0]; // Convert embeddings to array and return
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

async function embed(inputs) {
  // Check if the input is a string, and convert it to an array if needed
  if (typeof inputs === 'string') {
    inputs = [inputs];
  }

  // Tokenize the inputs using the tokenizer (ensure you have a tokenizer object initialized)
  const encodings = inputs.map(d => tokenizer.encode(d));

  // Create indices array
  const indicesArr = encodings.map((arr, i) => arr.map((d, index) => [i, index]));

  // Flatten the indices array
  let flattenedIndicesArr = [];
  for (let i = 0; i < indicesArr.length; i++) {
    flattenedIndicesArr = flattenedIndicesArr.concat(indicesArr[i]);
  }

  // Create tensors for indices and values
  const indices = tf.tensor2d(flattenedIndicesArr, [flattenedIndicesArr.length, 2], 'int32');
  const values = tf.tensor1d(tf.util.flatten(encodings), 'int32');

  // Prepare model inputs
  const modelInputs = { indices, values };

  // Execute the model (ensure 'model' is initialized)
  const embeddings = await model.executeAsync(modelInputs);

  // Dispose of tensors after use
  indices.dispose();
  values.dispose();

  return embeddings;
}