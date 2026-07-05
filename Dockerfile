FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

# Her şeyi kopyala (.dockerignore ile backend'i hariç tutacağız)
COPY . .

# Build-time'da env değişkenini al ve Next.js build'ine geçir
ARG NEXT_PUBLIC_BACKEND_URL
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]