// Add this to your command processor where you handle YouTube-specific commands

// When processing a command related to YouTube
if (command.toLowerCase().includes('youtube') && command.toLowerCase().includes('search')) {
    // Extract the search query
    const searchMatch = command.match(/search for (.*?)(?:,|\s+and|\s+filter|\s*$)/i);
    const searchQuery = searchMatch ? searchMatch[1] : '';

    // Navigate to YouTube
    await browserController.navigate('youtube.com');

    // Use the YouTube-specific search method
    if (searchQuery) {
        await browserController.handleYouTubeActions('search', { query: searchQuery });
    }

    // Check if filtering is requested
    if (command.toLowerCase().includes('filter') && command.toLowerCase().includes('this month')) {
        await browserController.handleYouTubeActions('filter');
    }

    return true;
}