FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

# Her şeyi kopyala (.dockerignore ile backend'i hariç tutacağız)
COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]