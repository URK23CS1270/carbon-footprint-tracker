// Get the display element from the DOM
const display = document.getElementById('display');

/**
 * Appends a given value to the display.
 * @param {string} value - The number or operator to append.
 */
function appendToDisplay(value) {
    // If the display currently shows "0" or an error, replace it
    if (display.value === '0' || display.value === 'Error') {
        display.value = value;
    } else {
        display.value += value;
    }
}

/**
 * Clears the display, setting it back to "0".
 */
function clearDisplay() {
    display.value = '0';
}

/**
 * Deletes the last character from the display.
 */
function deleteLast() {
    // If there's only one character or the display shows an error, clear it.
    if (display.value.length === 1 || display.value === 'Error') {
        clearDisplay();
    } else {
        display.value = display.value.slice(0, -1);
    }
}

/**
 * Calculates the result of the expression in the display.
 */
function calculateResult() {
    try {
        // Use the built-in eval() function to calculate the result.
        // eval() can be a security risk if used with untrusted user input,
        // but it's safe here since we control the input (only numbers and operators).
        const result = eval(display.value);

        // Check for division by zero which results in Infinity
        if (result === Infinity || result === -Infinity) {
            display.value = 'Error';
        } else {
            // Round to a reasonable number of decimal places to avoid floating point issues
            display.value = parseFloat(result.toFixed(10));
        }
    } catch (error) {
        // If the expression is invalid (e.g., "5++2"), display an error.
        display.value = 'Error';
    }
}