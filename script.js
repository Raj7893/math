const startBtn = document.getElementById('start-btn');
const answerBtn = document.getElementById('answer-btn');
const repeatBtn = document.getElementById('repeat-btn');
const settingsDiv = document.getElementById('settings');
const displayArea = document.getElementById('display-area');
const numberScreen = document.getElementById('number-screen');
const voiceToggle = document.getElementById('voice-toggle');
const themeSelect = document.getElementById('theme-select'); // New handle

const langSelect = document.getElementById('lang-select');
const typeSelect = document.getElementById('type-select');
const styleSelect = document.getElementById('style-select');

let currentSequence = [];
let correctAnswer = 0;
let currentIndex = 0;
let timeoutId = null;
let savedSpeed = 1500;
let savedUseVoice = true;

let allSystemVoices = [];
let selectedVoice = null;
let voiceIsFallback = false;

const voiceProfiles = {
    female: ['natural', 'neural', 'google', 'samantha', 'zira', 'hazel', 'heera', 'anna', 'moira', 'karen', 'kalpana', 'ekta', 'hema'],
    male: ['natural', 'neural', 'google', 'david', 'george', 'ravi', 'mark', 'alex', 'daniel', 'heman', 'anand'],
    human: ['natural', 'neural', 'google', 'premium', 'high quality']
};

const languageNamesMap = {
    'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German', 
    'it': 'Italian', 'ja': 'Japanese', 'zh': 'Chinese', 'hi': 'Hindi', 
    'pa': 'Punjabi', 'pt': 'Portuguese', 'ru': 'Russian', 'ko': 'Korean'
};

function getFullLanguageName(langTag) {
    const baseLang = langTag.split('-')[0].split('_')[0].toLowerCase();
    const region = langTag.split('-')[1] || langTag.split('_')[1] || '';
    let name = languageNamesMap[baseLang] || baseLang.toUpperCase();
    if (region) name += ` (${region.toUpperCase()})`;
    return name;
}

// Global Theme Listener Switch hook
themeSelect.addEventListener('change', (e) => {
    document.body.setAttribute('data-theme', e.target.value);
});

function initVoiceSetup() {
    allSystemVoices = window.speechSynthesis.getVoices();
    
    const uniqueLanguages = new Set(['en-US', 'hi-IN', 'pa-IN']);
    allSystemVoices.forEach(v => uniqueLanguages.add(v.lang));
    
    langSelect.innerHTML = `
        <option value="all">All System Languages</option>
        <option value="en-US" selected>English</option>
        <option value="hi-IN">Hindi (हिन्दी)</option>
        <option value="pa-IN">Punjabi (ਪੰਜਾਬੀ)</option>
    `;

    const detailedLangList = [];
    uniqueLanguages.forEach(lang => {
        if (lang !== 'hi-IN' && lang !== 'pa-IN' && !lang.startsWith('en')) {
            detailedLangList.push({ tag: lang, fullName: getFullLanguageName(lang) });
        }
    });

    detailedLangList.sort((a, b) => a.fullName.localeCompare(b.fullName));
    detailedLangList.forEach(item => {
        const option = document.createElement('option');
        option.value = item.tag;
        option.textContent = item.fullName;
        langSelect.appendChild(option);
    });

    langSelect.value = "en-US";
    autoSelectBestVoice();
}

function autoSelectBestVoice() {
    const selectedLang = langSelect.value;
    const selectedType = typeSelect.value;
    voiceIsFallback = false;

    const sortedVoices = [...allSystemVoices].sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        const aScore = (aName.includes('natural') || aName.includes('neural') || aName.includes('google')) ? 1 : 0;
        const bScore = (bName.includes('natural') || bName.includes('neural') || bName.includes('google')) ? 1 : 0;
        return bScore - aScore; 
    });

    let filteredVoices = sortedVoices.filter(voice => {
        const nameLower = voice.name.toLowerCase();
        if (selectedLang !== 'all' && !voice.lang.toLowerCase().startsWith(selectedLang.toLowerCase().substring(0, 2))) return false;

        if (selectedType === 'female') return voiceProfiles.female.some(name => nameLower.includes(name)) && !voiceProfiles.male.some(name => nameLower.includes(name));
        if (selectedType === 'male') return voiceProfiles.male.some(name => nameLower.includes(name));
        if (selectedType === 'human') return voiceProfiles.human.some(keyword => nameLower.includes(keyword)) || voice.localService === true;
        if (selectedType === 'robotic') return !voiceProfiles.human.some(keyword => nameLower.includes(keyword)) && voice.localService === false;
        return true;
    });

    if (filteredVoices.length > 0) {
        selectedVoice = filteredVoices[0];
    } else {
        const absoluteLangMatch = allSystemVoices.find(v => v.lang.toLowerCase().startsWith(selectedLang.substring(0,2).toLowerCase()));
        if (absoluteLangMatch) {
            selectedVoice = absoluteLangMatch;
        } else {
            selectedVoice = allSystemVoices.find(v => v.lang.startsWith('en')) || allSystemVoices[0];
            if (selectedLang === 'hi-IN' || selectedLang === 'pa-IN') {
                voiceIsFallback = true; 
            }
        }
    }
}

if (typeof window.speechSynthesis !== 'undefined' && window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = initVoiceSetup;
}
initVoiceSetup();

langSelect.addEventListener('change', autoSelectBestVoice);
typeSelect.addEventListener('change', autoSelectBestVoice);

voiceToggle.addEventListener('change', () => {
    document.getElementById('voice-config-section').className = voiceToggle.checked ? "" : "hidden";
});

startBtn.addEventListener('click', startSession);
answerBtn.addEventListener('click', showAnswer);
repeatBtn.addEventListener('click', repeatQuestion);

const hindiPhonetics = ["shoonya", "ek", "do", "teen", "chaar", "paanch", "chhe", "saat", "aath", "nau", "das"];
const punjabiPhonetics = ["shoonya", "ik", "do", "tinn", "chaar", "panj", "chhei", "satt", "atht", "nau", "das"];

function convertToIndianPhonetics(numberStr, lang) {
    const arr = numberStr.split("");
    const mapSource = (lang === 'hi') ? hindiPhonetics : punjabiPhonetics;
    return arr.map(digit => mapSource[parseInt(digit)] || "").join(" ");
}

function startSession() {
    const digits = parseInt(document.getElementById('digits').value);
    let rows = parseInt(document.getElementById('rows').value);
    const allowAdd = document.getElementById('op-add').checked;
    const allowSub = document.getElementById('op-sub').checked;
    savedSpeed = parseFloat(document.getElementById('speed').value) * 1000;
    savedUseVoice = voiceToggle.checked;

    if (!allowAdd && !allowSub) {
        alert('Please select at least one operation (Addition or Subtraction).');
        return;
    }
    if (isNaN(rows) || rows < 1) rows = 1;
    if (rows > 40) rows = 40;

    const min = Math.pow(10, digits - 1);
    const max = Math.pow(10, digits) - 1;

    currentSequence = [];
    let runningTotal = 0;

    for (let i = 0; i < rows; i++) {
        let num = Math.floor(Math.random() * (max - min + 1)) + min;
        if (i === 0) {
            currentSequence.push({ op: '+', val: num });
            runningTotal += num;
        } else {
            let op = allowAdd && allowSub ? (Math.random() < 0.5 ? '+' : '-') : (allowSub ? '-' : '+');
            if (op === '-' && runningTotal - num < 0) op = '+';
            currentSequence.push({ op: op, val: num });
            runningTotal = op === '+' ? runningTotal + num : runningTotal - num;
        }
    }

    correctAnswer = runningTotal;
    
    settingsDiv.classList.add('hidden');
    displayArea.classList.remove('hidden');
    answerBtn.classList.add('hidden');
    repeatBtn.classList.add('hidden');

    currentIndex = 0;
    if (savedUseVoice) window.speechSynthesis.cancel();
    runFlash(savedSpeed, savedUseVoice);
}

function triggerPopAnimation(text, isPulse = false) {
    numberScreen.innerText = text;
    numberScreen.className = ""; 
    void numberScreen.offsetWidth; 
    
    if (isPulse) {
        numberScreen.classList.add('animate-pulse-slow');
    } else {
        numberScreen.classList.add('animate-pop');
    }
}

function runFlash(speed, useVoice) {
    const readingStyle = styleSelect.value;
    const chosenLang = langSelect.value.substring(0, 2).toLowerCase();

    function showNext() {
        if (currentIndex < currentSequence.length) {
            const item = currentSequence[currentIndex];
            const displaySign = item.op === '-' ? '-' : '';
            const visualText = `${displaySign}${item.val}`;
            
            triggerPopAnimation(visualText);

            if (useVoice) {
                let speechText = "";
                let minusWord = "minus, ";

                if (chosenLang === 'hi') minusWord = voiceIsFallback ? "ghatao, " : "घटाओ, ";
                if (chosenLang === 'pa') minusWord = voiceIsFallback ? "ghatao, " : "ਘਟਾਓ, ";
                if (chosenLang === 'fr') minusWord = "moins, ";
                if (chosenLang === 'es') minusWord = "menos, ";

                if (voiceIsFallback) {
                    const phoneticNumbers = convertToIndianPhonetics(item.val.toString(), chosenLang);
                    speechText = (item.op === '-') ? minusWord + phoneticNumbers : phoneticNumbers;
                } else {
                    if (readingStyle === 'digits') {
                        const digitsArray = item.val.toString().split("").join(" ");
                        speechText = (item.op === '-') ? minusWord + digitsArray : digitsArray;
                    } else {
                        speechText = (item.op === '-') ? minusWord + item.val : item.val.toString();
                    }
                }
                
                const utterance = new SpeechSynthesisUtterance(speechText);
                if (selectedVoice) utterance.voice = selectedVoice;
                
                utterance.pitch = 1.02 + (Math.random() * 0.04 - 0.02); 

                if (speed < 1000) utterance.rate = 1.6; 
                else if (speed < 1500) utterance.rate = 1.2;
                else utterance.rate = 0.95;

                utterance.onend = function() {
                    currentIndex++;
                    timeoutId = setTimeout(showNext, speed);
                };
                utterance.onerror = function() {
                    currentIndex++;
                    showNext();
                };
                window.speechSynthesis.speak(utterance);
            } else {
                currentIndex++;
                timeoutId = setTimeout(showNext, speed);
            }
        } else {
            triggerPopAnimation("...", true);
            if (useVoice) {
                let closingPhrase = "That is";
                if (chosenLang === 'hi') closingPhrase = voiceIsFallback ? "barabar hai" : "बराबर है";
                if (chosenLang === 'pa') closingPhrase = voiceIsFallback ? "barabar hai" : "ਬਰਾਬਰ ਹੈ";
                if (chosenLang === 'fr') closingPhrase = "égal, ";
                if (chosenLang === 'es') closingPhrase = "es igual a, ";

                const finalUtterance = new SpeechSynthesisUtterance(closingPhrase);
                if (selectedVoice) finalUtterance.voice = selectedVoice;
                finalUtterance.pitch = 0.93; 
                finalUtterance.rate = 0.9;
                
                finalUtterance.onend = function() {
                    triggerPopAnimation("?");
                    answerBtn.classList.remove('hidden');
                };
                window.speechSynthesis.speak(finalUtterance);
            } else {
                triggerPopAnimation("?");
                answerBtn.classList.remove('hidden');
            }
        }
    }
    showNext();
}

function showAnswer() {
    triggerPopAnimation(correctAnswer);
    answerBtn.innerText = "Back to Options";
    repeatBtn.classList.remove('hidden'); 
    answerBtn.removeEventListener('click', showAnswer);
    answerBtn.addEventListener('click', resetApp);
}

function repeatQuestion() {
    answerBtn.classList.add('hidden');
    repeatBtn.classList.add('hidden');
    currentIndex = 0; 
    if (savedUseVoice) window.speechSynthesis.cancel();
    runFlash(savedSpeed, savedUseVoice);
}

function resetApp() {
    clearTimeout(timeoutId);
    window.speechSynthesis.cancel();
    settingsDiv.classList.remove('hidden');
    displayArea.classList.add('hidden');
    numberScreen.innerText = "";
    answerBtn.innerText = "Show Answer";
    repeatBtn.classList.add('hidden');
    answerBtn.removeEventListener('click', resetApp);
    answerBtn.addEventListener('click', showAnswer);
}
