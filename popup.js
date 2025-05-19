document.addEventListener('DOMContentLoaded', function() {
  const startButton = document.getElementById('startButton');
  const statusDiv = document.getElementById('status');
  let isSending = false;
  let currentIndex = 0;
  let phoneNumbers = [];
  let message = '';
  let interval = 0;

  function updateStatus(message, isError = false) {
    statusDiv.textContent = message;
    statusDiv.className = isError ? 'error' : 'success';
  }

  async function sendMessage(phoneNumber) {
    try {
      // Get the current active tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];

      // Check if we're on WhatsApp Web
      if (!currentTab.url.includes('web.whatsapp.com')) {
        updateStatus('Please open WhatsApp Web in your browser first!', true);
        return false;
      }

      // Navigate to the specific chat
      const whatsappUrl = `https://web.whatsapp.com/send?phone=${phoneNumber}&text=${encodeURIComponent(message)}`;
      await chrome.tabs.update(currentTab.id, { url: whatsappUrl });

      // Wait for the chat to load
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Inject the send message script
      const result = await chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        function: async () => {
          // Wait for the send button to appear
          const maxAttempts = 30;
          let attempts = 0;
          
          while (attempts < maxAttempts) {
            const sendButton = document.querySelector('button[aria-label="Send"]');
            if (sendButton) {
              sendButton.click();
              return true;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
          }
          return false;
        }
      });

      // Wait a bit after sending
      await new Promise(resolve => setTimeout(resolve, 2000));

      return result[0].result;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }

  async function processNextNumber() {
    if (currentIndex >= phoneNumbers.length) {
      isSending = false;
      startButton.textContent = 'Start Sending';
      updateStatus('All messages sent successfully!');
      return;
    }

    const phoneNumber = phoneNumbers[currentIndex];
    updateStatus(`Sending message to ${phoneNumber}...`);

    const success = await sendMessage(phoneNumber);
    
    if (success) {
      currentIndex++;
      updateStatus(`Message sent to ${phoneNumber}. Progress: ${currentIndex}/${phoneNumbers.length}`);
      
      if (currentIndex < phoneNumbers.length) {
        setTimeout(processNextNumber, interval * 1000);
      } else {
        isSending = false;
        startButton.textContent = 'Start Sending';
        updateStatus('All messages sent successfully!');
      }
    } else {
      isSending = false;
      startButton.textContent = 'Start Sending';
      updateStatus(`Failed to send message to ${phoneNumber}. Please try again.`, true);
    }
  }

  startButton.addEventListener('click', async function() {
    if (isSending) {
      isSending = false;
      startButton.textContent = 'Start Sending';
      updateStatus('Sending stopped.', true);
      return;
    }

    // Get values from form
    const phoneNumbersText = document.getElementById('phoneNumbers').value.trim();
    message = document.getElementById('message').value.trim();
    interval = parseInt(document.getElementById('interval').value);

    // Validate inputs
    if (!phoneNumbersText) {
      updateStatus('Please enter at least one phone number.', true);
      return;
    }
    if (!message) {
      updateStatus('Please enter a message.', true);
      return;
    }
    if (interval < 1) {
      updateStatus('Interval must be at least 1 second.', true);
      return;
    }

    // Process phone numbers
    phoneNumbers = phoneNumbersText.split('\n')
      .map(number => number.trim())
      .filter(number => number.length > 0);

    if (phoneNumbers.length === 0) {
      updateStatus('Please enter at least one valid phone number.', true);
      return;
    }

    // Start sending messages
    isSending = true;
    currentIndex = 0;
    startButton.textContent = 'Stop Sending';
    updateStatus('Starting to send messages...');
    processNextNumber();
  });
}); 