# TickerTraffic: Stock Volatility Highway

An interactive paper-trading visualizer where stocks are traffic lanes. Speed reflects volatility, red lanes highlight price drops, and switching lanes banks your distance earnings — while testing your regret when abandoned lanes rocket ahead.

Built for the **Berkeley x Google DeepMind Hackathon** (Sep 27, 2026), remote track.

## Demo videos

- [Full demo (2:33)](demo/demo-full.mp4)
- [Short demo (1:15)](demo/demo-short.mp4)

## Notes

- [Team Intro](docs/team-intro.md)
- [Project Description](docs/project-description.md)
- [Playcast Script](docs/playcast-script.md)

## Team

Solo submission by **Alex Rao**.

I graduated from Berkeley in 2022, majoring in Computer Science and Economics. Since then I've been working as a Software Engineer, primarily Full Stack Development.

I started off working in EdTech for 3 and a half years. Starting in January, I began working at CurieTechAI where I've focused on building AI agents and an agent deployment platform.

## Project description

The product I built today is called TickerTraffic. I came up with this on my way to the venue where I worked roughly for the same amount of time as the in-person teams.

I noticed that highway traffic is a solid metaphor for stock trading:

- When you buy a stock, it's like driving in a specific lane. If there are no cars in it, it's a smart investment. That's akin to a stock rally.
- A lane might suffer from heavy traffic, in the same way a stock might crash.
- You may switch lanes (sell your stock and buy another), but the original lane may clear up. That's selling too early / leaving money on the table.
- Some lanes consistently have less traffic (express lanes or the leftmost lane) like how some stocks tend to perform better.
- Refusing to ever switch lanes may get you caught in a slow lane forever in the same way holding a bad stock may represent an opportunity cost.
- On the highway, you need to switch to a low traffic lane before everyone else does and it gets crowded, beating the market so to speak.

Beyond the metaphor, the potential of this product is visualization and composition:

- Viewing the stock market as a series of graphs has its limitations. I'm a novice stock trader and the highway metaphor is easier for me to follow. I imagine since most people drive and not everyone trades, this is also true for others.
- Secondly, the car metaphor lets you go step by step, trading as you switch lanes. It's hard to come up with a plan from the ground up. It's easier to compose one following a series of discrete steps.

### How it plays

- Each lane represents a different ticker. Most of them are stocks, but there's also BTC just for fun.
- Collisions cause losses.
- Your vehicle is slow when changing lanes, which adds some risk.
- You can step on the brakes or speed up.
- Your dashboard has a ton of info to help you calculate your moves.
- Earnings and losses are split up for your analysis.
- You can stop on the shoulder — in other words, sell everything.

### Future work

The product is essentially a paper trading visualizer. If I had more time, I'd allow the player to save state and replay segments, creating recordings of different trades. I'd also try to make the tickers accurate. The cars also don't need to move in real time, even though it's fun. There should be different modes.

I see a lot of potential and growth in this tool, and would love to continue working on it after today.

## Running locally

Prerequisites: Node.js

1. Install dependencies: `npm install`
2. Start the dev server: `npm run dev` (runs on http://localhost:3000)
