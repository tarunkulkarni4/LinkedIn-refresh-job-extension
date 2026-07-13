// content.js – Dynamic periodic job scraper with Company Name extraction

function scanJobs() {
    // Select elements that have job ID attributes (both occludable and standard ones)
    const jobElements = document.querySelectorAll('[data-occludable-job-id], [data-job-id]');
    const jobs = [];

    jobElements.forEach(item => {
        const jobId = item.getAttribute('data-occludable-job-id') || item.getAttribute('data-job-id');
        if (jobId) {
            // Find job role title with broad container lookups
            let roleText = '';
            const titleEl = item.querySelector('.job-card-list__title, .job-card-container__link, .artdeco-entity-lockup__title a, [class*="job-card"][class*="title"]');
            
            if (titleEl) {
                roleText = titleEl.textContent.trim();
            } else {
                // Secondary fallback lookup for links with descriptive role texts
                const links = item.querySelectorAll('a');
                for (let link of links) {
                    const text = link.textContent.trim();
                    if (text && text.length > 5 && !text.includes('days ago') && !text.includes('actively hiring') && !text.includes('Connection')) {
                        roleText = text;
                        break;
                    }
                }
            }

            // Find company name with broad container lookups
            let companyText = '';
            const companyEl = item.querySelector('.job-card-container__company-name, .artdeco-entity-lockup__subtitle, .job-card-list__company-name, [class*="company-name"], [class*="company"]');
            if (companyEl) {
                // Split on newlines to ignore sub-ratings/stars if present
                companyText = companyEl.textContent.trim().split('\n')[0].trim();
            }

            // Clean whitespaces
            roleText = roleText.replace(/\s+/g, ' ').trim();
            companyText = companyText.replace(/\s+/g, ' ').trim();

            if (!roleText) roleText = 'Unknown Role';

            // Construct role with company name
            let fullTitle = roleText;
            if (companyText && companyText.length > 0 && !companyText.includes('followers') && !companyText.includes('connections')) {
                fullTitle = `${roleText} at ${companyText}`;
            }

            jobs.push({ id: jobId, title: fullTitle });
        }
    });

    if (jobs.length > 0) {
        chrome.runtime.sendMessage({
            type: "JOBS_SCANNED",
            jobs: jobs
        });
    }
}

// Perform initial scans
setTimeout(scanJobs, 1000);
setTimeout(scanJobs, 3000);

// Set up repeating interval scanner to handle scrolling and client-side page updates in LinkedIn
setInterval(scanJobs, 3500);
