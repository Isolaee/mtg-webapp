import React, { useState } from "react";
import { Card } from "../api";
import StackVisualizer from "../components/visualStack";
import FindCardForm from "../components/FindCard";

function TestPageFindCard() {
  const [cards, setCards] = useState<Card[]>([]);

  // Extract only the image URLs (filter out undefined)
  const imageUrls = cards
    .map((card) => card.image)
    .filter((img): img is string => Boolean(img));

  return (
    <div className="App">
      <h1>Magic: The Gathering Web App</h1>
      <FindCardForm onCardsFound={setCards} />
      <StackVisualizer images={imageUrls} />
    </div>
  );
}

export default TestPageFindCard;
