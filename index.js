// Global variables
let articles = [];
let currentFilteredArticles = [];

// List of markdown files to load
const markdownFiles = [
    //'template-article.md',
    //'02-07-2025-A01-IMPLEMENTANDO-SISTEMA-DE-ASSINATURA-E-PAGAMENTO-COM-STRIPE.md',
    '17-07-2025-A02-ENTENDA-A-GRANULARIDADE-NA-POO.md'
];

// Parse frontmatter from markdown content
function parseFrontmatter(content) {
    const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
    const match = content.match(frontmatterRegex);

    if (!match) {
        return {
            metadata: {},
            content: content
        };
    }

    const frontmatterText = match[1];
    const markdownContent = content.slice(match[0].length);
    const metadata = {};

    frontmatterText.split(/\r?\n/).forEach(line => {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length > 0) {
            let value = valueParts.join(':').trim();

            // Remove aspas
            if ((value.startsWith('"') && value.endsWith('"')) || 
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }

            // Parse de arrays (tags)
            if (value.startsWith('[') && value.endsWith(']')) {
                value = value.slice(1, -1).split(',').map(item => 
                    item.trim().replace(/['"]/g, '')
                );
            }

            metadata[key.trim()] = value;
        }
    });

    return {
        metadata,
        content: markdownContent
    };
}

// Generate slug from title or filename
function generateSlug(title, filename) {
    const text = title || filename.replace('.md', '');
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
}

// Load a single markdown file
async function loadMarkdownFile(filename) {
    try {
        const response = await fetch(`/articles/${filename}`);
        if (!response.ok) {
            throw new Error(`Failed to load ${filename}`);
        }
        
        const content = await response.text();
        const { metadata, content: markdownContent } = parseFrontmatter(content);
        
        const title = metadata.title || filename.replace('.md', '').replace(/-/g, ' ');
        const slug = generateSlug(title, filename);
        
        // Generate excerpt if not provided
        const excerpt = metadata.excerpt || 
            markdownContent.replace(/#{1,6}\s+/g, '').substring(0, 150) + '...';
        
        return {
            id: filename.replace('.md', ''),
            slug: slug,
            filename: filename,
            title: title,
            excerpt: excerpt,
            date: metadata.date || new Date().toISOString().split('T')[0],
            category: metadata.category || 'Geral',
            tags: metadata.tags || [],
            content: markdownContent,
            metadata: metadata
        };
    } catch (error) {
        console.error(`Error loading ${filename}:`, error);
        return null;
    }
}

// Load all markdown files
async function loadAllArticles() {
    const loadingState = document.getElementById('loadingState');
    const articlesGrid = document.getElementById('articlesGrid');
    
    if (loadingState) loadingState.style.display = 'block';
    if (articlesGrid) articlesGrid.style.display = 'none';
    
    try {
        const articlePromises = markdownFiles.map(loadMarkdownFile);
        const loadedArticles = await Promise.all(articlePromises);
        
        // Filter out failed loads and sort by date (newest first)
        articles = loadedArticles
            .filter(article => article !== null)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        
        currentFilteredArticles = [...articles];
        
        populateArticles(articles);
        populateSidebar();
        
    } catch (error) {
        console.error('Error loading articles:', error);
        if (articlesGrid) articlesGrid.innerHTML = '<p>Erro ao carregar artigos.</p>';
    } finally {
        if (loadingState) loadingState.style.display = 'none';
        if (articlesGrid) articlesGrid.style.display = 'grid';
    }
}

// Navigation with URL routing
function navigateTo(path) {
    history.pushState(null, '', path);
    handleRoute();
}

function handleRoute() {
    const path = window.location.pathname;
    const segments = path.split('/').filter(Boolean);
    
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // Update navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });

    if (path === '/' || path === '') {
        // Home page
        document.getElementById('home').classList.add('active');
        document.querySelector('[data-page="home"]').classList.add('active');
        document.title = 'Renan Rocha';
    } else if (path === '/archive') {
        // Archive page
        document.getElementById('archive').classList.add('active');
        document.querySelector('[data-page="archive"]').classList.add('active');
        document.title = 'Renan Rocha - Archives';
        
        if (articles.length === 0) {
            loadAllArticles();
        }
    } else if (segments[0] === 'article' && segments[1]) {
        // Article view page
        const slug = segments[1];
        showArticleBySlug(slug);
    } else {
        // 404 - redirect to home
        navigateTo('/');
    }
}

// Show individual article by slug
async function showArticleBySlug(slug) {
    if (articles.length === 0) {
        await loadAllArticles();
    }
    
    const article = articles.find(a => a.slug === slug);
    if (!article) {
        navigateTo('/');
        return;
    }
    
    const articleContent = document.getElementById('articleContent');
    
    // Convert markdown to HTML
    const htmlContent = marked.parse(article.content);
    
    articleContent.innerHTML = `
        <div class="article-header">
            <h1>${article.title}</h1>
            <div class="article-meta">
                <span>Postado em ${formatDate(article.date)}</span>
                <span>${article.category}</span>
            </div>
            <div style="margin-top: 1rem;">
                ${article.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
            </div>
        </div>
        <div class="article-content">
            ${htmlContent}
        </div>
    `;
    
    document.getElementById('article-view').classList.add('active');
    document.title = `Renan Rocha - ${article.title}`;
}

// Show individual article (legacy)
async function showArticle(articleId) {
    if (articles.length === 0) {
        await loadAllArticles();
    }
    
    const article = articles.find(a => a.id === articleId);
    if (!article) return;
    
    navigateTo(`/article/${article.slug}`);
}

// Populate articles in archive page
function populateArticles(articlesToShow) {
    const grid = document.getElementById('articlesGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    if (articlesToShow.length === 0) {
        grid.innerHTML = '<p>Nenhum artigo encontrado.</p>';
        return;
    }
    
    articlesToShow.forEach(article => {
        const articleCard = document.createElement('div');
        articleCard.className = 'article-card';
        articleCard.innerHTML = `
            ${article.metadata.coverImage ? `<img src="${article.metadata.coverImage}" alt="${article.title}" class="article-cover">` : ''}
            <div class="article-title">${article.title}</div>
            <div class="article-meta">
                <span>Postado em ${formatDate(article.date)}</span>
                <span>${article.category}</span>
            </div>
            <div class="article-excerpt">${article.excerpt}</div>
            <div style="margin-top: 1rem;">
                ${article.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
            </div>
        `;
        
        articleCard.addEventListener('click', () => {
            navigateTo(`/article/${article.slug}`);
        });
        
        grid.appendChild(articleCard);
    });
}

// Populate sidebar
function populateSidebar() {
    if (articles.length === 0) return;
    
    // Recent posts
    const recentPosts = document.getElementById('recentPosts');
    if (recentPosts) {
        const recentArticles = articles.slice(0, 5);
        
        recentPosts.innerHTML = recentArticles.map(article => `
            <li><a href="/article/${article.slug}" onclick="navigateTo('/article/${article.slug}'); return false;">${article.title}</a></li>
        `).join('');
    }
    
    // Categories
    const categories = {};
    articles.forEach(article => {
        categories[article.category] = (categories[article.category] || 0) + 1;
    });
    
    const categoryList = document.getElementById('categoryList');
    if (categoryList) {
        categoryList.innerHTML = Object.entries(categories).map(([category, count]) => `
            <li>
                <a href="#" onclick="filterByCategory('${category}'); return false;">
                    <span>${category}</span>
                    <span class="category-count">${count}</span>
                </a>
            </li>
        `).join('');
    }
}

// Search functionality
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;
    
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const filteredArticles = articles.filter(article => 
            article.title.toLowerCase().includes(query) ||
            article.excerpt.toLowerCase().includes(query) ||
            article.content.toLowerCase().includes(query) ||
            article.tags.some(tag => tag.toLowerCase().includes(query))
        );
        currentFilteredArticles = filteredArticles;
        populateArticles(filteredArticles);
    });
}

// Filter by category
function filterByCategory(category) {
    if (window.location.pathname !== '/archive') {
        navigateTo('/archive');
        setTimeout(() => filterByCategory(category), 100);
        return;
    }
    
    const filteredArticles = articles.filter(article => article.category === category);
    currentFilteredArticles = filteredArticles;
    populateArticles(filteredArticles);
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Navigation with routing
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const href = link.getAttribute('href');
            navigateTo(href);
        });
    });
    
    // Handle browser back/forward buttons
    window.addEventListener('popstate', handleRoute);
    
    // Setup search
    setupSearch();
    
    // Configure marked.js options
    if (typeof marked !== 'undefined') {
        marked.setOptions({
            highlight: function(code, lang) {
                return hljs.highlight(code, { language: lang }).value;
            },
            breaks: true,
            gfm: true
        });
    }
    
    // Initial route handling
    handleRoute();
    
    // Load articles on startup
    loadAllArticles();
});

// Function to reload articles (useful for development)
function reloadArticles() {
    articles = [];
    loadAllArticles();
}