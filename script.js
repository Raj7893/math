// Dynamic UI Component References
const startBtn = document.getElementById('start-btn');
const answerBtn = document.getElementById('answer-btn');
const repeatBtn = document.getElementById('repeat-btn');
const settingsDiv = document.getElementById('settings');
const displayArea = document.getElementById('display-area');
const numberScreen = document.getElementById('number-screen');
const voiceToggle = document.getElementById('voice-toggle');
const themeSelect = document.getElementById('theme-select');

const digitsSelect = document.getElementById('digits');
const digitsMainContainer = document.getElementById('digits-main-container');
const mixDigitsToggle = document.getElementById('mix-digits-toggle');
const mixDigitsSelector = document.getElementById('mix-digits-selector');

const rowsInput = document.getElementById('rows');
const opAddCheckbox = document.getElementById('op-add');
const opSubCheckbox = document.getElementById('op-sub');
const opMulCheckbox = document.getElementById('op-mul');
const opDivCheckbox = document.getElementById('op-div');
const speedInput = document.getElementById('speed');

const langSelect = document.getElementById('lang-select');
const typeSelect = document.getElementById('type-select');
const styleSelect = document.getElementById('style-select');

// Application Session Cache Structures
let currentSequence = [];
let correctAnswer = 0;
let currentIndex = 0;
let timeoutId = null;
let savedSpeed = 1000;
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

/* ==========================================================
   STATE SYNC PREFERENCES ENGINE (LOCALSTORAGE)
   ========================================================== */

function saveSettingsToStorage() {
    const activeMixPool = [];
    document.querySelectorAll('.mix-digit-pool:checked').forEach(cb => {
        activeMixPool.push(cb.value);
    });

    const appSettings = {
        theme: themeSelect.value,
        digits: digitsSelect.value,
        mixDigits: mixDigitsToggle.checked,
        mixDigitsPool: activeMixPool,
        rows: rowsInput.value,
        opAdd: opAddCheckbox.checked,
        opSub: opSubCheckbox.checked,
        opMul: opMulCheckbox.checked,
        opDiv: opDivCheckbox.checked,
        speed: speedInput.value,
        voiceEnabled: voiceToggle.checked,
        voiceLang: langSelect.value,
        voiceType: typeSelect.value,
        voiceStyle: styleSelect.value
    };
    localStorage.setItem('mathTrainerSettings', JSON.stringify(appSettings));
}

function loadSettingsFromStorage() {
    const savedData = localStorage.getItem('mathTrainerSettings');
    if (!savedData) return;

    try {
        const config = JSON.parse(savedData);
        
        if (config.theme) {
            themeSelect.value = config.theme;
            document.body.setAttribute('data-theme', config.theme);
        }
        if (config.digits) digitsSelect.value = config.digits;
        
        if (config.hasOwnProperty('mixDigits')) {
            mixDigitsToggle.checked = config.mixDigits;
            mixDigitsSelector.className = config.mixDigits ? "checkbox-group" : "hidden checkbox-group";
            digitsMainContainer.className = config.mixDigits ? "form-group hidden" : "form-group";
        }

        if (config.mixDigitsPool) {
            document.querySelectorAll('.mix-digit-pool').forEach(cb => {
                cb.checked = config.mixDigitsPool.includes(cb.value);
            });
        }

        if (config.rows) rowsInput.value = config.rows;
        if (config.speed) speedInput.value = config.speed;
        
        if (config.hasOwnProperty('opAdd')) opAddCheckbox.checked = config.opAdd;
        if (config.hasOwnProperty('opSub')) opSubCheckbox.checked = config.opSub;
        if (config.hasOwnProperty('opMul')) opMulCheckbox.checked = config.opMul;
        if (config.hasOwnProperty('opDiv')) opDivCheckbox.checked = config.opDiv;
        
        if (config.hasOwnProperty('voiceEnabled')) {
            voiceToggle.checked = config.voiceEnabled;
            document.getElementById('voice-config-section').className = config.voiceEnabled ? "" : "hidden";
        }
        if (config.voiceType) typeSelect.value = config.voiceType;
        if (config.voiceStyle) styleSelect.value = config.voiceStyle;
        
        if (config.voiceLang) langSelect.dataset.savedValue = config.voiceLang;

    } catch (e) {
        console.error("Local configuration restore exception: ", e);
    }
}

/* ==========================================================
   UI BINDINGS & REGISTRATION HANDLERS
   ========================================================== */

themeSelect.addEventListener('change', (e) => {
    document.body.setAttribute('data-theme', e.target.value);
    saveSettingsToStorage();
});

mixDigitsToggle.addEventListener('change', () => {
    const isChecked = mixDigitsToggle.checked;
    mixDigitsSelector.className = isChecked ? "checkbox-group" : "hidden checkbox-group";
    digitsMainContainer.className = isChecked ? "form-group hidden" : "form-group";
    saveSettingsToStorage();
});

document.querySelectorAll('.mix-digit-pool').forEach(cb => {
    cb.addEventListener('change', saveSettingsToStorage);
});

[digitsSelect, rowsInput, opAddCheckbox, opSubCheckbox, opMulCheckbox, opDivCheckbox, speedInput, voiceToggle, typeSelect, styleSelect].forEach(element => {
    element.addEventListener('change', saveSettingsToStorage);
});

langSelect.addEventListener('change', () => {
    autoSelectBestVoice();
    saveSettingsToStorage();
});

voiceToggle.addEventListener('change', () => {
    document.getElementById('voice-config-section').className = voiceToggle.checked ? "" : "hidden";
});

/* ==========================================================
   SPEECH AUDIO SYNTHESIS LOGIC ENGINE
   ========================================================== */

function initVoiceSetup() {
    allSystemVoices = window.speechSynthesis.getVoices();
    
    const uniqueLanguages = new Set(['en-US', 'hi-IN', 'pa-IN']);
    allSystemVoices.forEach(v => uniqueLanguages.add(v.lang));
    
    langSelect.innerHTML = `
        <option value="all">All System Languages</option>
        <option value="en-US">English</option>
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

    if (langSelect.dataset.savedValue) {
        langSelect.value = langSelect.dataset.savedValue;
        delete langSelect.dataset.savedValue;
    } else {
        langSelect.value = "en-US";
    }
    
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

loadSettingsFromStorage();
initVoiceSetup();

/* ==========================================================
   MATHEMATICAL RUNTIME CALCULATION PIPELINE
   ========================================================== */

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

function getRandomNumberFromSelection(chosenDigitsValue, isMixActive, checkedPoolValues) {
    let finalDigits = parseInt(chosenDigitsValue);
    
    if (isMixActive && checkedPoolValues.length > 0) {
        const randIndex = Math.floor(Math.random() * checkedPoolValues.length);
        finalDigits = parseInt(checkedPoolValues[randIndex]);
    }

    const min = Math.pow(10, finalDigits - 1);
    const max = Math.pow(10, finalDigits) - 1;
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function startSession() {
    let rows = parseInt(rowsInput.value);
    const allowAdd = opAddCheckbox.checked;
    const allowSub = opSubCheckbox.checked;
    const allowMul = opMulCheckbox.checked;
    const allowDiv = opDivCheckbox.checked;
    
    savedSpeed = parseFloat(speedInput.value) * 1000;
    savedUseVoice = voiceToggle.checked;

    const isMixActive = mixDigitsToggle.checked;
    const checkedPool = Array.from(document.querySelectorAll('.mix-digit-pool:checked')).map(cb => cb.value);

    if (!allowAdd && !allowSub && !allowMul && !allowDiv) {
        alert('Please select at least one operation.');
        return;
    }
    if (isMixActive && checkedPool.length === 0) {
        alert('Please select at least one digit size to mix.');
        return;
    }
    if (isNaN(rows) || rows < 1) rows = 1;
    if (rows > 40) rows = 40;

    currentSequence = [];
    let runningTotal = 0;

    for (let i = 0; i < rows; i++) {
        let num = getRandomNumberFromSelection(digitsSelect.value, isMixActive, checkedPool);
        
        if (i === 0) {
            currentSequence.push({ op: '+', val: num });
            runningTotal += num;
        } else {
            let allowedOps = [];
            if (allowAdd) allowedOps.push('+');
            if (allowSub) allowedOps.push('-');
            if (allowMul) allowedOps.push('*');
            if (allowDiv) allowedOps.push('/');

            let op = allowedOps[Math.floor(Math.random() * allowedOps.length)];

            if (op === '-' && runningTotal - num < 0) {
                if (allowAdd) op = '+';
                else num = Math.floor(Math.random() * (runningTotal || 1)) || 1;
            }

            if (op === '*') {
                if (runningTotal > 100 || num > 12) {
                    num = Math.floor(Math.random() * 10) + 2; 
                }
                if (runningTotal * num > 99999) {
                    op = allowSub && runningTotal > 50 ? '-' : '+';
                }
            }

            if (op === '/') {
                let divisors = [];
                for (let d = 2; d <= 20; d++) {
                    if (runningTotal % d === 0 && runningTotal / d > 0) divisors.push(d);
                }
                if (divisors.length > 0) {
                    num = divisors[Math.floor(Math.random() * divisors.length)];
                } else {
                    op = allowAdd ? '+' : (allowSub && runningTotal > 10 ? '-' : '+');
                }
            }

            if (op === '+') runningTotal += num;
            else if (op === '-') runningTotal -= num;
            else if (op === '*') runningTotal *= num;
            else if (op === '/') runningTotal /= num;

            currentSequence.push({ op: op, val: num });
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

function triggerPopAnimation(text) {
    numberScreen.innerText = text;
    numberScreen.className = ""; 
    void numberScreen.offsetWidth; 
    numberScreen.classList.add('animate-pop');
}

function runFlash(speed, useVoice) {
    const readingStyle = styleSelect.value;
    const chosenLang = langSelect.value.substring(0, 2).toLowerCase();

    function showNext() {
        if (currentIndex < currentSequence.length) {
            const item = currentSequence[currentIndex];
            let displaySign = "";
            if (item.op === '-') displaySign = "-";
            else if (item.op === '*') displaySign = "× ";
            else if (item.op === '/') displaySign = "÷ ";
            
            triggerPopAnimation(`${displaySign}${item.val}`);

            if (useVoice) {
                let speechText = "";
                let opWord = "";

                if (item.op === '-') {
                    opWord = "minus, ";
                    if (chosenLang === 'hi') opWord = voiceIsFallback ? "ghatao, " : "घटाओ, ";
                    if (chosenLang === 'pa') opWord = voiceIsFallback ? "ghatao, " : "ਘਟਾਓ, ";
                    if (chosenLang === 'fr') opWord = "moins, ";
                    if (chosenLang === 'es') opWord = "menos, ";
                } else if (item.op === '*') {
                    opWord = "multiply by, ";
                    if (chosenLang === 'hi') opWord = "guna, ";
                    if (chosenLang === 'pa') opWord = "guna, ";
                    if (chosenLang === 'fr') opWord = "multiplié par, ";
                    if (chosenLang === 'es') opWord = "multiplicado por, ";
                } else if (item.op === '/') {
                    opWord = "divided by, ";
                    if (chosenLang === 'hi') opWord = "bhaag, ";
                    if (chosenLang === 'pa') opWord = "bhaag, ";
                    if (chosenLang === 'fr') opWord = "divisé par, ";
                    if (chosenLang === 'es') opWord = "dividido por, ";
                }

                if (voiceIsFallback) {
                    const phoneticNumbers = convertToIndianPhonetics(item.val.toString(), chosenLang);
                    speechText = opWord + phoneticNumbers;
                } else {
                    if (readingStyle === 'digits') {
                        const digitsArray = item.val.toString().split("").join(" ");
                        speechText = opWord + digitsArray;
                    } else {
                        speechText = opWord + item.val.toString();
                    }
                }
                
                const utterance = new SpeechSynthesisUtterance(speechText);
                if (selectedVoice) utterance.voice = selectedVoice;

                if (speed < 1000) utterance.rate = 1.5; 
                else if (speed < 1500) utterance.rate = 1.15;
                else utterance.rate = 1.0;

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
            triggerPopAnimation("...");
            if (useVoice) {
                let closingPhrase = "That is";
                if (chosenLang === 'hi') closingPhrase = voiceIsFallback ? "barabar hai" : "बराबर है";
                if (chosenLang === 'pa') closingPhrase = voiceIsFallback ? "barabar hai" : "ਬਰਾਬਰ ਹੈ";
                if (chosenLang === 'fr') closingPhrase = "égal, ";
                if (chosenLang === 'es') closingPhrase = "es igual a, ";

                const finalUtterance = new SpeechSynthesisUtterance(closingPhrase);
                if (selectedVoice) finalUtterance.voice = selectedVoice;
                
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
