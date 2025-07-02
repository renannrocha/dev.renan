// Global variables
let articles = [];
let currentFilteredArticles = [];

// List of markdown files to load (you can also make this dynamic)
const markdownFiles = [
    'react-hooks.md',
    'docker.md', 
    'func-markdown.md'
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

// Load a single markdown file
async function loadMarkdownFile(filename) {
    try {
        const response = await fetch(`articles/${filename}`);
        if (!response.ok) {
            throw new Error(`Failed to load ${filename}`);
        }
        
        const content = await response.text();
        const { metadata, content: markdownContent } = parseFrontmatter(content);
        
        // Generate excerpt if not provided
        const excerpt = metadata.excerpt || 
            markdownContent.replace(/#{1,6}\s+/g, '').substring(0, 150) + '...';
        
        return {
            id: filename.replace('.md', ''),
            filename: filename,
            title: metadata.title || filename.replace('.md', '').replace(/-/g, ' '),
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
    
    loadingState.style.display = 'block';
    articlesGrid.style.display = 'none';
    
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
        articlesGrid.innerHTML = '<p>Erro ao carregar artigos.</p>';
    } finally {
        loadingState.style.display = 'none';
        articlesGrid.style.display = 'grid';
    }
}

// Navigation functionality
function showPage(pageName) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // Show selected page
    document.getElementById(pageName).classList.add('active');
    
    // Update navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    const navLink = document.querySelector(`[data-page="${pageName}"]`);
    if (navLink) {
        navLink.classList.add('active');
    }
    
    // Load articles when showing archive
    if (pageName === 'archive' && articles.length === 0) {
        loadAllArticles();
    }
}

// Show individual article
async function showArticle(articleId) {
    const article = articles.find(a => a.id === articleId);
    if (!article) return;
    
    const articleContent = document.getElementById('articleContent');
    
    // Convert markdown to HTML
    const htmlContent = marked.parse(article.content);
    
    articleContent.innerHTML = `
        <div class="article-header">
            <h1>${article.title}</h1>
            <div class="article-meta">
                <span>${formatDate(article.date)}</span>
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
    
    showPage('article-view');
}

// Populate articles in archive page
function populateArticles(articlesToShow) {
    const grid = document.getElementById('articlesGrid');
    grid.innerHTML = '';
    
    if (articlesToShow.length === 0) {
        grid.innerHTML = '<p>Nenhum artigo encontrado.</p>';
        return;
    }
    
    articlesToShow.forEach(article => {
        const articleCard = document.createElement('div');
        articleCard.className = 'article-card';
        articleCard.innerHTML = `
            <div class="article-title">${article.title}</div>
            <div class="article-meta">
                <span>${formatDate(article.date)}</span>
                <span>${article.category}</span>
            </div>
            <div class="article-excerpt">${article.excerpt}</div>
            <div style="margin-top: 1rem;">
                ${article.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
            </div>
        `;
        
        articleCard.addEventListener('click', () => {
            showArticle(article.id);
        });
        
        grid.appendChild(articleCard);
    });
}

// Populate sidebar
function populateSidebar() {
    if (articles.length === 0) return;
    
    // Recent posts
    const recentPosts = document.getElementById('recentPosts');
    const recentArticles = articles.slice(0, 5);
    
    recentPosts.innerHTML = recentArticles.map(article => `
        <li><a href="#" onclick="showArticle('${article.id}')">${article.title}</a></li>
    `).join('');
    
    // Categories
    const categories = {};
    articles.forEach(article => {
        categories[article.category] = (categories[article.category] || 0) + 1;
    });
    
    const categoryList = document.getElementById('categoryList');
    categoryList.innerHTML = Object.entries(categories).map(([category, count]) => `
        <li>
            <a href="#" onclick="filterByCategory('${category}')">
                <span>${category}</span>
                <span class="category-count">${count}</span>
            </a>
        </li>
    `).join('');
}

// Search functionality
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
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
    showPage('archive');
    const filteredArticles = articles.filter(article => article.category === category);
    currentFilteredArticles = filteredArticles;
    populateArticles(filteredArticles);
    document.getElementById('searchInput').value = '';
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            showPage(link.dataset.page);
        });
    });
    
    // Setup search
    setupSearch();
    
    // Configure marked.js options
    marked.setOptions({
        highlight: function(code, lang) {
            // You can add syntax highlighting here if needed
            return code;
        },
        breaks: true,
        gfm: true
    });
});

// Function to reload articles (useful for development)
function reloadArticles() {
    articles = [];
    loadAllArticles();
}