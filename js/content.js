// Create a style tag for hiding and showing the real timer button
document.head.insertAdjacentHTML('beforeend', '<style id="zoroark-timer-hiding">.timerbutton {} .zoroarkFakeTimerButton { float: right; }</style>');
const timerHidingCSSRule = Array.from(document.styleSheets).find(sheet => sheet.ownerNode.id === "zoroark-timer-hiding").cssRules[0];


// Identify which state a battle is in:
// - Not started
// - Turn in progress
// - Between turns
// - Ending
// - Ended [at which point the observer should be killed so we don't revert]
const startedBattles = new Set(); // Set of all battles that have started so we don't mess with replays and aren't fooled by fake replay controls that appear first
function identifyBattleState(controls) {
    if (controls.querySelector(".timerbutton")) {
        startedBattles.add(controls);
        if (controls.querySelector('[name="skipTurn"]')) {
            return "turnInProgress";
        } else {
            return "betweenTurns";
        }
    } else {
        if (startedBattles.has(controls)) {
            if (controls.querySelector('.replayDownloadButton')) {
                return "ended";
            } else {
                return "ending";
            }
        }
        return "not started";
    }
}

// Observer that looks for battle controls and starts an observer for each one
const globalObserver = new MutationObserver(mutations => mutations.forEach(mutation => {
    if (mutation.addedNodes && mutation.addedNodes.length > 0) {
        [].forEach.call(mutation.addedNodes, elem => {
            // Check if the added node or any of its children has the battle-controls class
            if (elem.nodeType === Node.ELEMENT_NODE) { // Text nodes aren't what we're looking for and will error on querySelector
                const controls = elem.classList != null && elem.classList.contains('battle-controls') ? elem : elem.querySelector('.battle-controls');
                if (controls) {
                    observeBattleControls(controls);
                }
            }
        });
    }
}));
// Observe for new battle controls
globalObserver.observe(document.body, { childList: true, subtree: true });
// Check for existing battle controls (e.g. in case of page reload)
addEventListener("load", _ => setTimeout(() => [...document.getElementsByClassName('battle-controls')].forEach(observeBattleControls), 500));


function createFakeTimerButton(controls) {
    // If there is a real timer button place the fake one next to it, otherwise place it before the "Skip turn" button
    let sibling = controls.querySelector('.timerbutton');
    if (!sibling) sibling = controls.querySelector('[name="skipTurn"]');
    // Hide the real timer button (via CSS rule so timer ticks don't interfere with it)
    timerHidingCSSRule.style.setProperty("display", "none", "important");
    // Delete any previously-existing fake buttons
    controls.querySelectorAll('.zoroarkFakeTimerButton').forEach(button => button.remove());
    // Create the new fake button
    sibling.insertAdjacentHTML('beforebegin', '<button disabled name="openTimer" class="button zoroarkFakeTimerButton"><i class="fa fa-hourglass-start"></i> Timer</button>');
    controls.querySelector('.zoroarkFakeTimerButton').addEventListener('click', event => event.stopPropagation(), true); // Disable clicking
}


function observeBattleControls(controls) {
    const controlsObserver = new MutationObserver(mutations => mutations.forEach(mutation => {
        const state = identifyBattleState(controls);
        // If a turn is in progress, replace the real timer button with a fake disabled one
        // But if there's no turn indicator yet then we're before turn 1 (i.e. in the animation of an automatic lead being sent out), so don't disable the timer
        if (state == "turnInProgress" && controls.parentElement.querySelector(".turn")) {
            createFakeTimerButton(controls);
        }
        // If the battle is in between turns, stop hiding the timer
        else if (state == "betweenTurns") {
            timerHidingCSSRule.style.removeProperty("display");
        }
        // If the battle is ending, hide all spoilers
        else if (state == "ending") {
            // Make the "Skip turn" button look normal
            controls.querySelector('[name="skipTurn"]').classList.remove('button-last');
            controls.querySelector('[name="skipTurn"]').removeAttribute('style');
            // Make the "Go to end" button look normal
            controls.querySelector('[name="goToEnd"]').classList.remove('button-last');
            // Add space between the "Skip turn" and "Go to end" buttons
            controls.querySelector('[name="skipTurn"]').insertAdjacentText("afterend", " ");
            // Delete the "Pause", "First turn", and "Prev turn" buttons
            [...controls.querySelectorAll('[name="rewindTurn"], [name="instantReplay"], [name="pause"]')].forEach(button => button.remove());
            // Delete the "Switch viewpoint" button
            controls.querySelector('p > [name="switchViewpoint"]')?.parentElement.remove();
            // Make a fake disabled timer button
            createFakeTimerButton(controls);
        }
        // If the battle ended, clean up the observer (so we don't mess with controls during instant replay)
        else if (state == "ended") {
            controlsObserver.disconnect();
        }
        // If the battle hasn't started do nothing
    }));
    identifyBattleState(controls); // Check if the battle is active when the controls first appear, so we don't misreport a battle as "not started" the first time it mutates
    controlsObserver.observe(controls, { childList: true });
}
