All credits go to: https://github.com/cedricpinson/globetweeter

# To start

```
npm i
```

# To deploy on my server for the first time

```sh
cd ~/apps
git clone https://github.com/umaar/wiki-globe
cd wiki-globe
npm i
npm run start-production-process
```

# Nginx Configuration (virtual host config file)

```
location /globe {
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-NginX-Proxy true;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Host $host;
    proxy_http_version 1.1;
    proxy_pass http://127.0.0.1:<PORT_HERE>;
}
```

# Github Webhook

```sh
cd ~/apps/wiki-globe/
git fetch origin master
git reset --hard origin/master
npm i
npm run stop-production-process
npm run start-production-process
```

# Copy private vars

```sh
touch ~/development/wiki-globe/config/default.json && jq -s add ~/development/wiki-globe/config/default.json ~/.wiki-globe.json > ~/development/wiki-globe/__tmp__config.json && cp ~/development/wiki-globe/__tmp__config.json ~/development/wiki-globe/config/default.json && rm ~/development/wiki-globe/__tmp__config.json
```

# Warning for node.js

A detached process is spawned by the server. Killing the main parent process with the process manager can also kill detached child processes in the same parent tree. Use the `--no-treekill` to avoid this issue, or, simply use `pm2 restart` instead of explicitly stopping and starting the process.

# Process management

```sh
pm2 startup
# follow instructions of the above command

pm2 save
```