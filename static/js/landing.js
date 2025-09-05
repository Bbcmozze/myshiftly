// Landing Page JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Intersection Observer for scroll animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const element = entry.target;
                const delay = element.dataset.delay || 0;
                
                setTimeout(() => {
                    element.style.animationDelay = delay + 'ms';
                    element.classList.add('animated');
                }, delay);
                
                observer.unobserve(element);
            }
        });
    }, observerOptions);

    // Observe all animated elements
    const animatedElements = document.querySelectorAll([
        '.fade-in-up',
        '.slide-in-left', 
        '.slide-in-right',
        '.slide-in-up',
        '.fade-in-left',
        '.fade-in-right'
    ].join(','));

    animatedElements.forEach(el => {
        observer.observe(el);
    });

    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Parallax effect for hero section
    const heroSection = document.querySelector('.hero-section');
    const shapes = document.querySelectorAll('.shape');
    
    if (heroSection) {
        window.addEventListener('scroll', () => {
            const scrolled = window.pageYOffset;
            const rate = scrolled * -0.5;
            
            shapes.forEach((shape, index) => {
                const speed = 0.2 + (index * 0.1);
                shape.style.transform = `translateY(${scrolled * speed}px)`;
            });
        });
    }

    // Counter animation for stats
    const animateCounters = () => {
        const counters = document.querySelectorAll('.stat-number');
        
        counters.forEach(counter => {
            const target = counter.textContent;
            const isPercentage = target.includes('%');
            const isPlus = target.includes('+');
            const isSlash = target.includes('/');
            
            let finalNumber;
            if (isPercentage) {
                finalNumber = parseFloat(target);
            } else if (isPlus) {
                finalNumber = parseInt(target);
            } else if (isSlash) {
                // For 24/7, just animate the first number
                finalNumber = 24;
            } else {
                finalNumber = parseInt(target) || 0;
            }
            
            if (finalNumber > 0) {
                counter.textContent = '0';
                
                const increment = finalNumber / 100;
                let current = 0;
                
                const timer = setInterval(() => {
                    current += increment;
                    if (current >= finalNumber) {
                        current = finalNumber;
                        clearInterval(timer);
                    }
                    
                    if (isPercentage) {
                        counter.textContent = current.toFixed(1) + '%';
                    } else if (isPlus) {
                        counter.textContent = Math.floor(current) + '+';
                    } else if (isSlash) {
                        counter.textContent = '24/7';
                    } else {
                        counter.textContent = Math.floor(current);
                    }
                }, 20);
            }
        });
    };

    // Trigger counter animation when stats section is visible
    const statsSection = document.querySelector('.hero-stats');
    if (statsSection) {
        const statsObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    animateCounters();
                    statsObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });
        
        statsObserver.observe(statsSection);
    }

    // Enhanced button hover effects
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(button => {
        button.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-2px) scale(1.02)';
        });
        
        button.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });

    // Feature card tilt effect
    const featureCards = document.querySelectorAll('.feature-card, .dashboard-card');
    featureCards.forEach(card => {
        card.addEventListener('mouseenter', function(e) {
            const rect = this.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            this.addEventListener('mousemove', handleTilt);
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(-10px)';
            this.removeEventListener('mousemove', handleTilt);
        });
    });

    function handleTilt(e) {
        const rect = this.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        const mouseX = e.clientX - centerX;
        const mouseY = e.clientY - centerY;
        
        const rotateX = (mouseY / rect.height) * -10;
        const rotateY = (mouseX / rect.width) * 10;
        
        this.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-10px)`;
    }

    // Typing effect for hero title
    const heroTitle = document.querySelector('.hero-title');
    if (heroTitle) {
        const text = heroTitle.innerHTML;
        heroTitle.innerHTML = '';
        
        let i = 0;
        const typeWriter = () => {
            if (i < text.length) {
                heroTitle.innerHTML += text.charAt(i);
                i++;
                setTimeout(typeWriter, 50);
            }
        };
        
        // Start typing effect after a short delay
        setTimeout(typeWriter, 500);
    }

    // Progress indicator for scroll
    const createScrollProgress = () => {
        const progressBar = document.createElement('div');
        progressBar.className = 'scroll-progress';
        progressBar.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 0%;
            height: 3px;
            background: linear-gradient(90deg, #667eea, #764ba2);
            z-index: 9999;
            transition: width 0.1s ease;
        `;
        document.body.appendChild(progressBar);
        
        window.addEventListener('scroll', () => {
            const scrolled = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
            progressBar.style.width = scrolled + '%';
        });
    };
    
    createScrollProgress();

    // Screenshot placeholder interactions
    const screenshots = document.querySelectorAll('.screenshot-placeholder');
    screenshots.forEach(screenshot => {
        screenshot.addEventListener('click', function() {
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = 'scale(1)';
            }, 150);
        });
        
        screenshot.addEventListener('mouseenter', function() {
            this.style.borderStyle = 'solid';
            this.style.backgroundColor = 'rgba(99, 102, 241, 0.1)';
        });
        
        screenshot.addEventListener('mouseleave', function() {
            this.style.borderStyle = 'dashed';
            this.style.backgroundColor = '';
        });
    });

    // Lazy loading for images (when screenshots are added)
    const lazyImages = document.querySelectorAll('img[data-src]');
    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.remove('lazy');
                imageObserver.unobserve(img);
            }
        });
    });
    
    lazyImages.forEach(img => imageObserver.observe(img));

    // Enhanced step animation
    const steps = document.querySelectorAll('.step-item');
    steps.forEach((step, index) => {
        const stepObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    setTimeout(() => {
                        entry.target.style.transform = 'translateY(0) scale(1)';
                        entry.target.style.opacity = '1';
                    }, index * 200);
                    stepObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.3 });
        
        step.style.transform = 'translateY(30px) scale(0.9)';
        step.style.opacity = '0';
        step.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
        
        stepObserver.observe(step);
    });

    // Add floating animation to benefit icons
    const benefitIcons = document.querySelectorAll('.benefit-icon');
    benefitIcons.forEach((icon, index) => {
        icon.style.animation = `float 3s ease-in-out infinite`;
        icon.style.animationDelay = `${index * 0.5}s`;
    });

    // Gradient animation for CTA section
    const ctaSection = document.querySelector('.cta-section');
    if (ctaSection) {
        let gradientPosition = 0;
        setInterval(() => {
            gradientPosition += 1;
            ctaSection.style.backgroundImage = `linear-gradient(${135 + gradientPosition}deg, #667eea 0%, #764ba2 100%)`;
        }, 100);
    }

    // Screenshot modal functionality
    const createScreenshotModal = () => {
        // Create modal HTML
        const modalHTML = `
            <div id="screenshot-modal" class="screenshot-modal">
                <div class="modal-content">
                    <span class="modal-close">&times;</span>
                    <img id="modal-image" src="" alt="Screenshot">
                    <div class="modal-caption"></div>
                </div>
            </div>
        `;
        
        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        const modal = document.getElementById('screenshot-modal');
        const modalImg = document.getElementById('modal-image');
        const modalCaption = document.querySelector('.modal-caption');
        const closeBtn = document.querySelector('.modal-close');
        
        // Add click handlers to all screenshot images
        const screenshots = document.querySelectorAll('.screenshot-image');
        screenshots.forEach(img => {
            img.style.cursor = 'pointer';
            img.addEventListener('click', function() {
                modal.style.display = 'block';
                modalImg.src = this.src;
                modalCaption.textContent = this.alt;
                document.body.style.overflow = 'hidden'; // Prevent background scrolling
            });
        });
        
        // Close modal handlers
        const closeModal = () => {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto'; // Restore scrolling
        };
        
        closeBtn.addEventListener('click', closeModal);
        
        // Close when clicking outside the image
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeModal();
            }
        });
        
        // Close with Escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && modal.style.display === 'block') {
                closeModal();
            }
        });
    };
    
    // Initialize screenshot modal
    createScreenshotModal();

    // Console welcome message
    console.log(`
    🚀 My Shiftly Landing Page
    ========================
    Добро пожаловать в My Shiftly!
    Система управления сменами нового поколения.
    
    Разработано с ❤️ для эффективного планирования.
    `);
});

// Utility functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Performance optimization for scroll events
const optimizedScroll = debounce(() => {
    // Any scroll-based animations that need optimization
}, 16); // ~60fps

window.addEventListener('scroll', optimizedScroll);
