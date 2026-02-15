-- Create Words Table
CREATE TABLE "Words" (
    id SERIAL PRIMARY KEY,
    word VARCHAR(255) UNIQUE NOT NULL,
    word_type VARCHAR(50) NOT NULL,  -- New field (noun, verb, adjective, etc.)
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create Datasets Table
CREATE TABLE "Datasets" (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    time_period VARCHAR(50) NOT NULL,  -- Example: "1800s", "2000s"
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create Texts Table (Acts as Associative Table)
CREATE TABLE "Texts" (
    id SERIAL PRIMARY KEY,
    word_id INT NOT NULL REFERENCES "Words"(id) ON DELETE CASCADE,
    dataset_id INT NOT NULL REFERENCES "Datasets"(id) ON DELETE CASCADE,
    content TEXT NOT NULL,  -- Stores actual dataset text (sentence context)
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create Semantic Changes Table
CREATE TABLE "Semantic_changes" (
    id SERIAL PRIMARY KEY,
    word_id INT NOT NULL REFERENCES "Words"(id) ON DELETE CASCADE,
    change_score FLOAT NOT NULL,  -- 0-1 scale (how much meaning changed)
    explanation TEXT,  -- Description of meaning shift
    timestamp TIMESTAMP DEFAULT NOW()
);
