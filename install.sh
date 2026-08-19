#!/usr/bin/env bash

# ==============================================================================
#  ██████╗   ██████╗  ██████╗  █████╗ ███╗   ███╗███████╗██████╗ 
#  ██╔══██╗ ██╔════╝ ██╔════╝ ██╔══██╗████╗ ████║██╔════╝██╔══██╗
#  ██████╔╝ ██║  ███╗██║  ███╗███████║██╔████╔██║█████╗  ██████╔╝
#  ██╔══██╗ ██║   ██║██║   ██║██╔══██║██║╚██╔╝██║██╔══╝  ██╔══██╗
#  ██║  ██║ ╚██████╔╝╚██████╔╝██║  ██║██║ ╚═╝ ██║███████╗██║  ██║
#  ╚═╝  ╚═╝  ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝     ╚═╝╚══════╝╚═╝  ╚═╝
#
#  Product Name : RGGAMER PANEL
#  Panel Banner : RGGAMER PANEL
#  Version      : v3.0
#  Creator      : RGGAMER
#  Repository   : https://github.com/RG1GAMER/PERSNOLY-PANEL3.git
# ==============================================================================

set -e

# Panel Core Configuration
PANEL_TITLE="RGGAMER PANEL"
PANEL_SUBTITLE="RGGAMER PANEL"
PANEL_AUTHOR="RGGAMER"
PANEL_VERSION="3.0"
DEFAULT_PROD_PORT=6767
DEFAULT_DEV_PORT=30000
REPO_URL="https://github.com/RG1GAMER/PERSNOLY-PANEL3.git"

# High-Contrast Deep ANSI Palette
C_RESET='\033[0m'
C_BOLD='\033[1m'
C_DIM='\033[2m'

# Foreground Colors
C_DEEP_BLUE='\033[38;5;33m'
C_VIBRANT_CYAN='\033[38;5;45m'
C_ELECTRIC_PURPLE='\033[38;5;141m'
C_EMERALD='\033[38;5;48m'
C_AMBER='\033[38;5;214m'
C_ROSE='\033[38;5;204m'
C_CRIMSON='\033[38;5;196m'
C_WHITE='\033[38;5;255m'
C_MUTED='\033[38;5;244m'

# Background Badges
BG_CYAN='\033[48;5;31;38;5;255m'
BG_GREEN='\033[48;5;28;38;5;255m'
BG_AMBER='\033[48;5;208;38;5;232m'
BG_RED='\033[48;5;160;38;5;255m'
BG_PURPLE='\033[48;5;93;38;5;255m'

print_banner() {
    clear
    echo -e "${C_VIBRANT_CYAN}${C_BOLD}"
    echo "  ██████╗   ██████╗  ██████╗  █████╗ ███╗   ███╗███████╗██████╗ "
    echo "  ██╔══██╗ ██╔════╝ ██╔════╝ ██╔══██╗████╗ ████║██╔════╝██╔══██╗"
    echo "  ██████╔╝ ██║  ███╗██║  ███╗███████║██╔████╔██║█████╗  ██████╔╝"
    echo "  ██╔══██╗ ██║   ██║██║   ██║██╔══██║██║╚██╔╝██║██╔══╝  ██╔══██╗"
    echo "  ██║  ██║ ╚██████╔╝╚██████╔╝██║  ██║██║ ╚═╝ ██║███████╗██║  ██║"
    echo "  ╚═╝  ╚═╝  ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝     ╚═╝╚══════╝╚═╝  ╚═╝"
    echo -e "${C_RESET}"
    echo -e "${C_DEEP_BLUE}  ╭──────────────────────────────────────────────────────────────────────────╮${C_RESET}"
    echo -e "${C_DEEP_BLUE}  │ ${C_WHITE}${C_BOLD}                     ${PANEL_SUBTITLE} (v${PANEL_VERSION})                         ${C_DEEP_BLUE}│${C_RESET}"
    echo -e "${C_DEEP_BLUE}  │ ${C_MUTED}         Next-Gen Game Server & Workload Control Dashboard                ${C_DEEP_BLUE}│${C_RESET}"
    echo -e "${C_DEEP_BLUE}  │ ${C_AMBER}                  Credit / Author: ${C_WHITE}${C_BOLD}${PANEL_AUTHOR}                               ${C_DEEP_BLUE}│${C_RESET}"
    echo -e "${C_DEEP_BLUE}  │ ${C_VIBRANT_CYAN}         Repo: ${C_WHITE}https://github.com/RG1GAMER/PERSNOLY-PANEL3          ${C_DEEP_BLUE}│${C_RESET}"
    echo -e "${C_DEEP_BLUE}  ╰──────────────────────────────────────────────────────────────────────────╯${C_RESET}"
    echo ""
}

log_info() {
    echo -e " ${C_DEEP_BLUE}[INFO]${C_RESET} ${C_WHITE}$1${C_RESET}"
}

log_success() {
    echo -e " ${C_EMERALD}${C_BOLD}[✓ SUCCESS]${C_RESET} ${C_WHITE}$1${C_RESET}"
}

log_warning() {
    echo -e " ${C_AMBER}${C_BOLD}[! WARNING]${C_RESET} ${C_AMBER}$1${C_RESET}"
}

log_error() {
    echo -e " ${C_CRIMSON}${C_BOLD}[✗ ERROR]${C_RESET} ${C_CRIMSON}$1${C_RESET}"
}

check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_warning "Running as non-root user. If package installation fails, please execute: sudo bash install.sh"
    fi
}

get_public_ip() {
    local ip
    ip=$(curl -s --max-time 4 https://api.ipify.org 2>/dev/null || curl -s --max-time 4 https://ifconfig.me 2>/dev/null || curl -s --max-time 4 https://icanhazip.com 2>/dev/null || echo "127.0.0.1")
    echo "$ip" | tr -d '\n' | tr -d '\r'
}

setup_system_dependencies() {
    log_info "Updating system package registry and tools..."

    if command -v apt-get &> /dev/null; then
        # Resolve any interrupted dpkg states and clear stale archive caches that trigger EXDEV / cross-device link errors
        sudo dpkg --configure -a 2>/dev/null || true
        sudo apt-get clean 2>/dev/null || true
        sudo rm -f /var/cache/apt/archives/*.deb 2>/dev/null || true

        # Detect only missing packages to avoid re-unpacking already working binaries
        local needed=()
        command -v curl &>/dev/null || needed+=("curl")
        command -v git &>/dev/null || needed+=("git")
        command -v tar &>/dev/null || needed+=("tar")
        command -v xz &>/dev/null || needed+=("xz-utils")
        command -v jq &>/dev/null || needed+=("jq")
        command -v ufw &>/dev/null || needed+=("ufw")
        [ -f /etc/ssl/certs/ca-certificates.crt ] || needed+=("ca-certificates")
        command -v make &>/dev/null || needed+=("build-essential")

        if [ ${#needed[@]} -gt 0 ]; then
            sudo DEBIAN_FRONTEND=noninteractive apt-get update -y -qq 2>/dev/null || true
            sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends \
                -o Dpkg::Options::="--force-confdef" \
                -o Dpkg::Options::="--force-confold" \
                -o Dpkg::Options::="--force-overwrite" \
                "${needed[@]}" 2>/dev/null || {
                    for pkg in "${needed[@]}"; do
                        sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends "$pkg" 2>/dev/null || true
                    done
                }
        fi
    elif command -v yum &> /dev/null; then
        sudo yum update -y -q || true
        sudo yum install -y -q curl git make gcc-c++ ca-certificates tar xz jq || true
    elif command -v pacman &> /dev/null; then
        sudo pacman -Sy --noconfirm curl git base-devel ca-certificates tar xz jq || true
    fi
    log_success "Base system dependencies configured."
}

ensure_nodejs() {
    log_info "Verifying Node.js 20+ runtime environment..."
    local need_install=0

    if ! command -v node &> /dev/null; then
        need_install=1
    else
        local node_ver
        node_ver=$(node -v | cut -d'.' -f1 | tr -d 'v')
        if [ "$node_ver" -lt 20 ]; then
            log_warning "Detected legacy Node.js ($(node -v)). Upgrading to Node.js 22 LTS..."
            need_install=1
        fi
    fi

    if [ "$need_install" -eq 1 ]; then
        log_info "Installing Node.js 22.x LTS..."
        if command -v apt-get &> /dev/null; then
            curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
            sudo apt-get install -y nodejs
        elif command -v yum &> /dev/null; then
            curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
            sudo yum install -y nodejs
        fi
    fi

    log_success "Node.js $(node -v) & npm $(npm -v) verified."
}

prompt_runtime_configuration() {
    echo ""
    echo -e "${C_ELECTRIC_PURPLE}  ╭──────────────────────────────────────────────────────────────────────────╮${C_RESET}"
    echo -e "${C_ELECTRIC_PURPLE}  │ ${C_WHITE}${C_BOLD}           STEP 1: SELECT SERVER EXECUTION RUNTIME ENGINE                 ${C_ELECTRIC_PURPLE}│${C_RESET}"
    echo -e "${C_ELECTRIC_PURPLE}  ╰──────────────────────────────────────────────────────────────────────────╯${C_RESET}"
    echo -e "  Choose how server processes (Minecraft, Node.js, Python) execute on this node:"
    echo ""
    echo -e "  ${C_DEEP_BLUE}${C_BOLD} [ 1 ] Docker Container Sandbox ${C_EMERALD}(Recommended for Production)${C_RESET}"
    echo -e "        ${C_MUTED}Isolated per-server Docker containers with memory & CPU limits.${C_RESET}"
    echo ""
    echo -e "  ${C_AMBER}${C_BOLD} [ 2 ] Local Process Engine ${C_MUTED}(Direct Host Execution via Node/Java/Python)${C_RESET}"
    echo -e "        ${C_MUTED}Spawns background child processes natively directly on the host.${C_RESET}"
    echo ""
    echo -e "  ${C_MUTED}--------------------------------------------------------------------------${C_RESET}"
    echo -e "  ${C_VIBRANT_CYAN}ℹ Notice: On standard panel (port ${DEFAULT_PROD_PORT}), all server creations use this default.${C_RESET}"
    echo -e "  ${C_VIBRANT_CYAN}  Per-server runtime selection is enabled exclusively in the Developer Panel.${C_RESET}"
    echo -e "  ${C_MUTED}--------------------------------------------------------------------------${C_RESET}"
    
    local choice
    read -r -p "  Enter Selection [1 or 2, default: 1]: " choice
    choice=$(echo "$choice" | tr -d ' ')

    case "$choice" in
        2)
            SELECTED_RUNTIME="local"
            RUNTIME_MODE="local"
            ;;
        *)
            SELECTED_RUNTIME="docker"
            RUNTIME_MODE="docker"
            ;;
    esac

    RUNTIME_LOCKED="true"
    echo ""
    log_success "Active Server Runtime: ${C_BOLD}${SELECTED_RUNTIME}${C_RESET} (Enforced & Locked for standard panel)"
}

prompt_theme_selection() {
    echo ""
    echo -e "${C_ELECTRIC_PURPLE}  ╭──────────────────────────────────────────────────────────────────────────╮${C_RESET}"
    echo -e "${C_ELECTRIC_PURPLE}  │ ${C_WHITE}${C_BOLD}               STEP 2: SELECT PANEL ACCENT COLOR THEME                    ${C_ELECTRIC_PURPLE}│${C_RESET}"
    echo -e "${C_ELECTRIC_PURPLE}  ╰──────────────────────────────────────────────────────────────────────────╯${C_RESET}"
    echo -e "  Select the primary brand & accent color scheme for the panel interface:"
    echo ""
    echo -e "  ${C_CRIMSON} [ 1 ] Crimson Red   ${C_MUTED}(Signature JTG Red)${C_RESET}"
    echo -e "  ${C_DEEP_BLUE} [ 2 ] Cobalt Blue   ${C_MUTED}(Classic Deep Blue)${C_RESET}"
    echo -e "  ${C_ELECTRIC_PURPLE} [ 3 ] Neon Purple   ${C_MUTED}(Cyberpunk Glow)${C_RESET}"
    echo -e "  ${C_VIBRANT_CYAN} [ 4 ] Cyber Cyan    ${C_MUTED}(Electric Aqua)${C_RESET}"
    echo -e "  ${C_EMERALD} [ 5 ] Emerald Green ${C_MUTED}(Vibrant Matrix)${C_RESET}"
    echo -e "  ${C_AMBER} [ 6 ] Amber Gold    ${C_MUTED}(Warm Radiant)${C_RESET}"
    echo -e "  ${C_ROSE} [ 7 ] Vivid Rose    ${C_MUTED}(Pastel Neon)${C_RESET}"
    echo -e "  ${C_WHITE} [ 8 ] Clean Slate   ${C_MUTED}(Monochrome Minimal)${C_RESET}"
    echo ""
    
    local theme_choice
    read -r -p "  Enter Theme Selection [1-8, default: 1]: " theme_choice
    theme_choice=$(echo "$theme_choice" | tr -d ' ')

    case "$theme_choice" in
        2) SELECTED_THEME="blue" ;;
        3) SELECTED_THEME="purple" ;;
        4) SELECTED_THEME="cyan" ;;
        5) SELECTED_THEME="green" ;;
        6) SELECTED_THEME="amber" ;;
        7) SELECTED_THEME="rose" ;;
        8) SELECTED_THEME="white" ;;
        *) SELECTED_THEME="red" ;;
    esac

    echo ""
    log_success "Panel Accent Theme Set: ${C_BOLD}${SELECTED_THEME}${C_RESET}"
}

prompt_java_install() {
    echo ""
    echo -e "${C_DEEP_BLUE}  ╭──────────────────────────────────────────────────────────────────────────╮${C_RESET}"
    echo -e "${C_DEEP_BLUE}  │ ${C_WHITE}${C_BOLD}             STEP 3: JAVA RUNTIME (MINECRAFT LOCAL ENGINE)                ${C_DEEP_BLUE}│${C_RESET}"
    echo -e "${C_DEEP_BLUE}  ╰──────────────────────────────────────────────────────────────────────────╯${C_RESET}"
    
    if command -v java &> /dev/null; then
        log_success "Java is already installed ($(java -version 2>&1 | head -n 1))."
    elif [ -f ".data/bin/jre-21/bin/java" ]; then
        log_success "Portable OpenJDK 21 LTS detected in .data/bin/jre-21."
    else
        local install_java
        read -r -p "  Install OpenJDK 21 Java Runtime on host? [y/N, default: y]: " install_java
        install_java=$(echo "$install_java" | tr -d ' ')
        if [[ "$install_java" =~ ^[Nn]$ ]]; then
            log_info "Skipping host Java installation. (The panel auto-provisions portable JRE on demand)."
        else
            log_info "Installing OpenJDK 21..."
            if command -v apt-get &> /dev/null; then
                sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends \
                    -o Dpkg::Options::="--force-confdef" \
                    -o Dpkg::Options::="--force-confold" \
                    -o Dpkg::Options::="--force-overwrite" \
                    openjdk-21-jre-headless 2>/dev/null || sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends openjdk-17-jre-headless 2>/dev/null || log_warning "System Java package unavailable. Portable JRE will be used."
            elif command -v yum &> /dev/null; then
                sudo yum install -y -q java-21-openjdk-headless || sudo yum install -y -q java-17-openjdk-headless || true
            fi
            log_success "Java runtime verified."
        fi
    fi
}

prompt_docker_install() {
    echo ""
    echo -e "${C_DEEP_BLUE}  ╭──────────────────────────────────────────────────────────────────────────╮${C_RESET}"
    echo -e "${C_DEEP_BLUE}  │ ${C_WHITE}${C_BOLD}               STEP 4: DOCKER CONTAINER ENGINE VERIFICATION              ${C_DEEP_BLUE}│${C_RESET}"
    echo -e "${C_DEEP_BLUE}  ╰──────────────────────────────────────────────────────────────────────────╯${C_RESET}"

    if command -v docker &> /dev/null; then
        log_success "Docker Engine is active ($(docker --version 2>/dev/null | head -n 1))."
    else
        if [ "$SELECTED_RUNTIME" = "docker" ]; then
            log_info "Installing Docker Engine for container isolation..."
            curl -fsSL https://get.docker.com | sudo sh
            sudo systemctl enable --now docker 2>/dev/null || true
            sudo usermod -aG docker "$USER" 2>/dev/null || true
            log_success "Docker Engine installed and started."
        else
            local install_docker
            read -r -p "  Install Docker Engine? [y/N, default: n]: " install_docker
            if [[ "$install_docker" =~ ^[Yy]$ ]]; then
                curl -fsSL https://get.docker.com | sudo sh
                sudo systemctl enable --now docker 2>/dev/null || true
                sudo usermod -aG docker "$USER" 2>/dev/null || true
                log_success "Docker installed."
            else
                log_info "Docker skipped (Local Process mode selected)."
            fi
        fi
    fi
}

ensure_cloudflared() {
    if command -v cloudflared &> /dev/null; then
        return 0
    fi
    log_info "Installing Cloudflare Tunnel daemon (cloudflared)..."
    local arch
    arch=$(uname -m)
    local cf_binary="cloudflared-linux-amd64"
    if [[ "$arch" == "aarch64" || "$arch" == "arm64" ]]; then
        cf_binary="cloudflared-linux-arm64"
    elif [[ "$arch" == "armv7l" || "$arch" == "armhf" ]]; then
        cf_binary="cloudflared-linux-arm"
    fi
    
    if sudo curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/${cf_binary}" -o /usr/local/bin/cloudflared 2>/dev/null; then
        sudo chmod +x /usr/local/bin/cloudflared
        log_success "cloudflared installed successfully."
    else
        log_warning "Could not download cloudflared directly. Trying system package..."
        if command -v apt-get &> /dev/null; then
            curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null || true
            echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared jammy main' | sudo tee /etc/apt/sources.list.d/cloudflared.list || true
            sudo apt-get update -qq && sudo apt-get install -y -qq cloudflared || true
        fi
    fi
}

setup_cloud_domain() {
    local target_port="${1:-$DEFAULT_PROD_PORT}"
    echo ""
    echo -e "${C_ELECTRIC_PURPLE}  ╭──────────────────────────────────────────────────────────────────────────╮${C_RESET}"
    echo -e "${C_ELECTRIC_PURPLE}  │ ${C_WHITE}${C_BOLD}        CLOUD DOMAIN & CLOUDFLARE SSL TUNNEL CONFIGURATION                 ${C_ELECTRIC_PURPLE}│${C_RESET}"
    echo -e "${C_ELECTRIC_PURPLE}  ╰──────────────────────────────────────────────────────────────────────────╯${C_RESET}"
    echo -e "  Connect your panel to a public Cloud Domain with free SSL & DDoS protection:"
    echo ""
    echo -e "  ${C_VIBRANT_CYAN}${C_BOLD} [ 1 ] Free Instant Cloudflare Tunnel (trycloudflare.com)${C_RESET}"
    echo -e "        ${C_MUTED}Instant public HTTPS URL with zero domain setup and no port forwarding required.${C_RESET}"
    echo ""
    echo -e "  ${C_EMERALD}${C_BOLD} [ 2 ] Cloudflare Custom Domain Tunnel Token${C_RESET}"
    echo -e "        ${C_MUTED}Connect your own domain (e.g. panel.yourdomain.com) via Cloudflare Zero Trust token.${C_RESET}"
    echo ""
    echo -e "  ${C_AMBER}${C_BOLD} [ 3 ] Nginx Reverse Proxy + Free Let's Encrypt SSL (Certbot)${C_RESET}"
    echo -e "        ${C_MUTED}Automatic Nginx setup with Let's Encrypt SSL for domain pointed to VPS IP.${C_RESET}"
    echo ""
    echo -e "  ${C_MUTED} [ 4 ] Skip Cloud Domain (Use VPS IP:Port directly)${C_RESET}"
    echo ""
    
    local cchoice
    read -r -p "  Enter selection [1-4, default: 4]: " cchoice
    cchoice=$(echo "$cchoice" | tr -d ' ')

    case "$cchoice" in
        1)
            ensure_cloudflared
            log_info "Starting instant Cloudflare Tunnel for port ${target_port}..."
            mkdir -p .data/logs
            pm2 delete rggamer-tunnel 2>/dev/null || true
            
            if command -v pm2 &>/dev/null; then
                pm2 start "cloudflared tunnel --url http://localhost:${target_port}" --name "rggamer-tunnel" --output .data/logs/tunnel.log --error .data/logs/tunnel-err.log 2>/dev/null || true
                pm2 save 2>/dev/null || true
            else
                nohup cloudflared tunnel --url "http://localhost:${target_port}" > .data/logs/tunnel.log 2>&1 &
            fi
            
            sleep 4
            local tunnel_url
            tunnel_url=$(grep -oE "https://[a-zA-Z0-9-]+\.trycloudflare\.com" .data/logs/tunnel.log 2>/dev/null | tail -n 1 || true)
            if [ -n "$tunnel_url" ]; then
                log_success "Instant Cloud Domain is live: ${C_VIBRANT_CYAN}${C_BOLD}${tunnel_url}${C_RESET}"
                echo "PUBLIC_URL=${tunnel_url}" >> .env 2>/dev/null || true
                echo "DOMAIN=${tunnel_url}" >> .env 2>/dev/null || true
            else
                log_info "Tunnel started in background. View public URL using: ${C_WHITE}cat .data/logs/tunnel.log | grep trycloudflare${C_RESET}"
            fi
            ;;
        2)
            ensure_cloudflared
            echo ""
            read -r -p "  Paste your Cloudflare Tunnel Token: " cf_token
            cf_token=$(echo "$cf_token" | tr -d ' ' | tr -d '\n' | tr -d '\r')
            if [ -n "$cf_token" ]; then
                log_info "Installing Cloudflare Tunnel system service..."
                sudo cloudflared service install "$cf_token" 2>/dev/null || sudo cloudflared service install --force "$cf_token" 2>/dev/null || true
                sudo systemctl enable --now cloudflared 2>/dev/null || true
                log_success "Cloudflare Tunnel service configured and active!"
                echo -e "  Your custom domain routed in Cloudflare is now connected to ${C_VIBRANT_CYAN}http://localhost:${target_port}${C_RESET}."
            else
                log_warning "No token provided. Skipping Cloudflare token setup."
            fi
            ;;
        3)
            echo ""
            read -r -p "  Enter your domain name (e.g. panel.mysite.com): " custom_domain
            custom_domain=$(echo "$custom_domain" | tr -d ' ')
            if [ -n "$custom_domain" ]; then
                log_info "Installing Nginx & Certbot..."
                if command -v apt-get &>/dev/null; then
                    sudo DEBIAN_FRONTEND=noninteractive apt-get update -y -qq
                    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nginx certbot python3-certbot-nginx
                elif command -v yum &>/dev/null; then
                    sudo yum install -y nginx certbot python3-certbot-nginx
                fi
                
                local nginx_conf="/etc/nginx/sites-available/rggamer-panel"
                [ -d "/etc/nginx/conf.d" ] && nginx_conf="/etc/nginx/conf.d/rggamer-panel.conf"
                
                cat > /tmp/rggamer-panel.conf <<EOF
server {
    listen 80;
    server_name ${custom_domain};

    location / {
        proxy_pass http://127.0.0.1:${target_port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_buffering off;
        client_max_body_size 500M;
    }
}
EOF
                sudo cp /tmp/rggamer-panel.conf "$nginx_conf" 2>/dev/null || true
                [ -d "/etc/nginx/sites-enabled" ] && sudo ln -sf "$nginx_conf" /etc/nginx/sites-enabled/ 2>/dev/null || true
                sudo nginx -t 2>/dev/null && sudo systemctl reload nginx 2>/dev/null || true
                
                read -r -p "  Issue free Let's Encrypt SSL with Certbot? [y/N]: " do_ssl
                if [[ "$do_ssl" =~ ^[Yy]$ ]]; then
                    sudo certbot --nginx -d "$custom_domain" --non-interactive --agree-tos -m "admin@${custom_domain}" --redirect || log_warning "Certbot validation failed. Verify DNS points to this VPS IP."
                fi
                log_success "Domain ${custom_domain} configured with Nginx reverse proxy!"
            fi
            ;;
        *)
            log_info "Skipping Cloud Domain setup. Panel accessible via IP:Port."
            ;;
    esac
}

prepare_repository() {
    log_info "Preparing application workspace from ${REPO_URL}..."

    # Check if we are already inside the project workspace
    if [ -f "package.json" ]; then
        PROJECT_DIR="$(pwd)"
        log_info "Using current workspace directory: ${PROJECT_DIR}"
        if [ -d ".git" ]; then
            git remote set-url origin "$REPO_URL" 2>/dev/null || true
        fi
    elif [ -d "PERSNOLY-PANEL3" ]; then
        PROJECT_DIR="$(pwd)/PERSNOLY-PANEL3"
        cd "$PROJECT_DIR"
        log_info "Found existing 'PERSNOLY-PANEL3' directory. Syncing repository with ${REPO_URL}..."
        if [ -d ".git" ]; then
            git remote set-url origin "$REPO_URL" 2>/dev/null || true
        fi
        git pull "$REPO_URL" main 2>/dev/null || git pull "$REPO_URL" master 2>/dev/null || git pull origin main 2>/dev/null || git pull || true
    elif [ -d "Jtg" ]; then
        PROJECT_DIR="$(pwd)/Jtg"
        cd "$PROJECT_DIR"
        log_info "Found existing 'Jtg' directory. Syncing repository with ${REPO_URL}..."
        if [ -d ".git" ]; then
            git remote set-url origin "$REPO_URL" 2>/dev/null || true
        fi
        git pull "$REPO_URL" main 2>/dev/null || git pull "$REPO_URL" master 2>/dev/null || git pull origin main 2>/dev/null || git pull || true
    else
        log_info "Cloning RGGAMER Panel from ${REPO_URL}..."
        git clone "$REPO_URL" PERSNOLY-PANEL3
        PROJECT_DIR="$(pwd)/PERSNOLY-PANEL3"
        cd "$PROJECT_DIR"
    fi
}

setup_environment() {
    local target_port=$1
    local run_mode=$2

    log_info "Initializing environment & data structures..."

    # Cleanly ensure directories without file/directory collision
    if [ -f ".logs" ]; then
        rm -f ".logs"
    fi
    mkdir -p .data/servers .data/temp .data/logs backups .logs 2>/dev/null || true

    # Generate JWT Secret
    local jwt_secret
    jwt_secret=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" 2>/dev/null || echo "rggamer_secret_key_$(date +%s)")

    cat > .env <<EOF
# ==============================================================================
# RGGAMER PANEL Configuration
# Credit: RGGAMER
# Repository: https://github.com/RG1GAMER/PERSNOLY-PANEL3.git
# ==============================================================================
NODE_ENV=${run_mode}
PORT=${target_port}
JWT_SECRET=${jwt_secret}
DEFAULT_RUNTIME=${SELECTED_RUNTIME:-docker}
ENABLE_DOCKER=$( [ "${SELECTED_RUNTIME:-docker}" = "docker" ] && echo "true" || echo "false" )
PANEL_RUNTIME_MODE=${RUNTIME_MODE:-docker}
PANEL_RUNTIME_LOCKED=${RUNTIME_LOCKED:-true}
PANEL_THEME=${SELECTED_THEME:-red}
DEV_MODE=$( [ "$run_mode" = "development" ] && echo "true" || echo "false" )
PANEL_DEV_MODE=$( [ "$run_mode" = "development" ] && echo "true" || echo "false" )
EOF

    # Persist runtime & theme settings to .data/settings.json
    node -e '
      const fs = require("fs");
      const path = ".data/settings.json";
      let s = {};
      try { if (fs.existsSync(path)) s = JSON.parse(fs.readFileSync(path, "utf8")); } catch(e){}
      s.defaultRuntime = process.env.DEFAULT_RUNTIME || "docker";
      s.runtimeLocked = process.env.PANEL_RUNTIME_LOCKED === "true";
      if (process.env.PANEL_THEME) s.theme = process.env.PANEL_THEME;
      fs.writeFileSync(path, JSON.stringify(s, null, 2));
    ' 2>/dev/null || true

    log_success "Environment configured on port ${target_port} (Runtime: ${SELECTED_RUNTIME:-docker}, Theme: ${SELECTED_THEME:-red})."
}

build_application() {
    log_info "Installing NPM dependencies..."
    npm install --no-audit --no-fund --quiet

    log_info "Compiling frontend assets & bundling server..."
    npm run build

    log_success "Application compilation succeeded."
}

configure_pm2_service() {
    local target_port=$1
    log_info "Configuring high-availability background process daemon..."

    if ! command -v pm2 &> /dev/null; then
        sudo npm install -g pm2 2>/dev/null || npm install -g pm2 2>/dev/null || true
    fi

    # Terminate existing instance if present
    pm2 delete jtg-panel 2>/dev/null || npx pm2 delete jtg-panel 2>/dev/null || true

    # Launch daemon
    PORT="${target_port}" npx pm2 start "scripts/start-with-update.sh" --name "jtg-panel" 2>/dev/null || PORT="${target_port}" npx pm2 start "dist/server.cjs" --name "jtg-panel"
    npx pm2 save 2>/dev/null || true

    if [ "$EUID" -eq 0 ]; then
        npx pm2 startup systemd -u root --hp /root 2>/dev/null || true
    fi

    log_success "PM2 service 'jtg-panel' registered and active."
}

create_initial_admin() {
    echo ""
    echo -e "${C_ELECTRIC_PURPLE}  ╭──────────────────────────────────────────────────────────────────────────╮${C_RESET}"
    echo -e "${C_ELECTRIC_PURPLE}  │ ${C_WHITE}${C_BOLD}                   CREATE PRIMARY OWNER ACCOUNT                           ${C_ELECTRIC_PURPLE}│${C_RESET}"
    echo -e "${C_ELECTRIC_PURPLE}  ╰──────────────────────────────────────────────────────────────────────────╯${C_RESET}"
    npm run createuser || true
}

install_production() {
    print_banner
    echo -e " ${BG_GREEN}${C_BOLD} [ PRODUCTION INSTALLATION ] ${C_RESET} ${C_WHITE}Deploying ${PANEL_TITLE} on port ${DEFAULT_PROD_PORT}${C_RESET}\n"
    
    check_root
    setup_system_dependencies
    ensure_nodejs
    prompt_runtime_configuration
    prompt_theme_selection
    prompt_java_install
    prompt_docker_install

    prepare_repository
    setup_environment "$DEFAULT_PROD_PORT" "production"
    build_application
    configure_pm2_service "$DEFAULT_PROD_PORT"
    
    # Prompt for optional Cloud Domain / Cloudflare SSL Tunnel
    setup_cloud_domain "$DEFAULT_PROD_PORT"

    create_initial_admin

    local server_ip
    server_ip=$(get_public_ip)
    
    echo ""
    echo -e "${C_EMERALD}${C_BOLD}  ╔══════════════════════════════════════════════════════════════════════════╗${C_RESET}"
    echo -e "${C_EMERALD}${C_BOLD}  ║                   ${PANEL_TITLE} INSTALLED SUCCESSFULLY!                     ║${C_RESET}"
    echo -e "${C_EMERALD}${C_BOLD}  ╚══════════════════════════════════════════════════════════════════════════╝${C_RESET}"
    echo ""
    echo -e "  ${C_MUTED}>>${C_RESET} ${C_WHITE}${C_BOLD}Panel Web Interface:${C_RESET}    ${C_VIBRANT_CYAN}${C_BOLD}http://${server_ip}:${DEFAULT_PROD_PORT}${C_RESET}"
    echo -e "  ${C_MUTED}>>${C_RESET} ${C_WHITE}${C_BOLD}Localhost Access:${C_RESET}       ${C_VIBRANT_CYAN}${C_BOLD}http://localhost:${DEFAULT_PROD_PORT}${C_RESET}"
    echo -e "  ${C_MUTED}>>${C_RESET} ${C_WHITE}${C_BOLD}Enforced Runtime:${C_RESET}       ${C_AMBER}${SELECTED_RUNTIME:-docker}${C_RESET} (Locked: ${RUNTIME_LOCKED:-true})"
    echo -e "  ${C_MUTED}>>${C_RESET} ${C_WHITE}${C_BOLD}Accent Theme:${C_RESET}           ${C_ELECTRIC_PURPLE}${SELECTED_THEME:-red}${C_RESET}"
    echo -e "  ${C_MUTED}>>${C_RESET} ${C_WHITE}${C_BOLD}Creator / Credit:${C_RESET}       ${C_EMERALD}${PANEL_AUTHOR}${C_RESET}"
    echo ""
    echo -e "  ${C_MUTED}┌── Useful Management Commands ───────────────────────────────────────────┐${C_RESET}"
    echo -e "  ${C_MUTED}│${C_RESET} Check Status:     ${C_VIBRANT_CYAN}npx pm2 status${C_RESET}"
    echo -e "  ${C_MUTED}│${C_RESET} Live Logs:        ${C_VIBRANT_CYAN}npx pm2 logs jtg-panel${C_RESET}"
    echo -e "  ${C_MUTED}│${C_RESET} Restart Panel:    ${C_VIBRANT_CYAN}npx pm2 restart jtg-panel${C_RESET}"
    echo -e "  ${C_MUTED}│${C_RESET} Cloud Domain SSL: ${C_VIBRANT_CYAN}Option [6] in bash install.sh${C_RESET}"
    echo -e "  ${C_MUTED}│${C_RESET} Update Panel:     ${C_VIBRANT_CYAN}bash update.sh${C_RESET}"
    echo -e "  ${C_MUTED}│${C_RESET} Uninstall:        ${C_VIBRANT_CYAN}bash uninstall.sh${C_RESET}"
    echo -e "  ${C_MUTED}└─────────────────────────────────────────────────────────────────────────┘${C_RESET}"
    echo ""
}

install_development() {
    print_banner
    echo -e " ${BG_AMBER}${C_BOLD} [ DEVELOPMENT SETUP ] ${C_RESET} ${C_WHITE}Configuring ${PANEL_TITLE} Dev Environment on port ${DEFAULT_DEV_PORT}${C_RESET}\n"
    
    setup_system_dependencies
    ensure_nodejs
    prompt_runtime_configuration
    prompt_theme_selection
    prepare_repository
    setup_environment "$DEFAULT_DEV_PORT" "development"
    
    log_info "Installing dependencies..."
    npm install
    create_initial_admin

    echo ""
    log_success "Development workspace ready!"
    echo -e "  Start development server: ${C_VIBRANT_CYAN}npm run dev${C_RESET}"
}

# Main Interactive Dispatcher
while true; do
    print_banner
    echo -e "  ${C_DEEP_BLUE}${C_BOLD} [ 1 ] ${C_WHITE}Install ${PANEL_TITLE} (Production Deployment - Port ${DEFAULT_PROD_PORT})${C_RESET}"
    echo -e "  ${C_DEEP_BLUE}${C_BOLD} [ 2 ] ${C_WHITE}Install ${PANEL_TITLE} (Development Mode - Port ${DEFAULT_DEV_PORT})${C_RESET}"
    echo -e "  ${C_DEEP_BLUE}${C_BOLD} [ 3 ] ${C_WHITE}Update Panel (Pull GitHub updates & rebuild)${C_RESET}"
    echo -e "  ${C_DEEP_BLUE}${C_BOLD} [ 4 ] ${C_WHITE}Create / Reset Administrator Account${C_RESET}"
    echo -e "  ${C_DEEP_BLUE}${C_BOLD} [ 5 ] ${C_WHITE}Restart Panel Service${C_RESET}"
    echo -e "  ${C_DEEP_BLUE}${C_BOLD} [ 6 ] ${C_ELECTRIC_PURPLE}${C_BOLD}Setup Cloud Domain / Cloudflare SSL Tunnel${C_RESET}"
    echo -e "  ${C_DEEP_BLUE}${C_BOLD} [ 7 ] ${C_WHITE}Uninstall Panel${C_RESET}"
    echo -e "  ${C_DEEP_BLUE}${C_BOLD} [ 8 ] ${C_MUTED}Exit${C_RESET}"
    echo ""
    echo -e "  ${C_MUTED}──────────────────────────────────────────────────────────────────────────${C_RESET}"
    
    read -r -p "  Select an option [1-8]: " option
    option=$(echo "$option" | tr -d ' ')

    case "$option" in
        1)
            install_production
            echo ""
            read -r -p "  Press Enter to return to main menu..." _
            ;;
        2)
            install_development
            echo ""
            read -r -p "  Press Enter to return to main menu..." _
            ;;
        3)
            bash update.sh
            echo ""
            read -r -p "  Press Enter to return to main menu..." _
            ;;
        4)
            npm run createuser || (cd PERSNOLY-PANEL3 && npm run createuser) || (cd Jtg && npm run createuser) || true
            echo ""
            read -r -p "  Press Enter to return to main menu..." _
            ;;
        5)
            log_info "Restarting RGGAMER Panel..."
            pm2 restart jtg-panel 2>/dev/null || pm2 restart rggamer-panel 2>/dev/null || npx pm2 restart jtg-panel 2>/dev/null || npm run start:auto-update
            log_success "Panel service restarted."
            echo ""
            read -r -p "  Press Enter to return to main menu..." _
            ;;
        6)
            setup_cloud_domain "$DEFAULT_PROD_PORT"
            echo ""
            read -r -p "  Press Enter to return to main menu..." _
            ;;
        7)
            bash uninstall.sh
            exit 0
            ;;
        8)
            echo -e "\n  ${C_AMBER}Exiting installer. Thank you for using ${PANEL_TITLE}!${C_RESET}\n"
            exit 0
            ;;
        *)
            log_error "Invalid selection. Please enter a number between 1 and 8."
            sleep 1.2
            ;;
    esac
done
