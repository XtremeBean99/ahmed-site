import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // --- Projects ---
  const projects = [
    {
      slug: "xtreme-builds",
      title: "Xtreme Builds",
      summary: "Custom PC building and hardware consultancy. Over 110 builds across 2022 to 2025 under the Xtreme Bean brand.",
      descriptionMd: "## Xtreme Builds\n\nCustom PC building under the Xtreme Bean brand. Over 110 builds completed from 2022 to 2025, averaging about one PC a week at peak.\n\n### How it started\n\nXtreme Bean was my Steam gamer tag from about six years ago. I came up with it randomly and it just stuck. What started with taking apart the family PC in 2022 turned into a full custom build operation by 2023. In the early days I was buying secondhand parts off Facebook Marketplace, cleaning them up, and flipping them into working machines.\n\n### Services\n\n- Custom PC assembly for gaming rigs, creative workstations, and general purpose\n- Themed builds: Monster Energy, Hello Kitty, stock market, whatever people wanted\n- Component sourcing, both new and refurbished\n- System testing, benchmarking, and setup\n- 3D printed accessories and branded merch\n\n### Tools\n\n- Creality Ender E3 V3 (2023), upgraded to Bambu Labs P1S with AMS (2025)\n- Did one custom water cooling loop. Hard, expensive, not worth it for performance, but great learning\n\n### Key builds\n\n| Build | When | Notes |\n|-------|------|-------|\n| First ever | 2022 | Intel Core i7 2600K, tore apart the family PC |\n| Monster Energy | Jan 2024 | Instagram inspired |\n| Stock Market | Apr 2024 | Custom client request |\n| Hello Kitty | Jul 2024 | Pink case I could not resist |\n| Daydream Machine | Early 2025 | Canberra creative learning studio |\n| Water cooled | Oct 2025 | First custom loop |\n\nI stopped building in 2026 to focus on uni but the skills stuck around.",
      year: 2023,
      tags: ["Hardware", "PC Building", "Custom Systems", "3D Printing"],
      published: true,
      sortOrder: 1,
    },
    {
      slug: "daydream-machine-custom-build",
      title: "Daydream Machine custom build",
      summary: "Bespoke hardware for a Canberra creative learning studio supporting neurodivergent young people. Full lifecycle from spec to handover.",
      descriptionMd: "## Daydream Machine custom build\n\n**Client:** Daydream Machine, Fyshwick, Canberra\n\nDaydream Machine is a creative learning studio for neurodivergent young people aged 9 to 21. Founded by Luke Ferguson, the 2022 ACT Local Hero. They run programs in music, art, LEGO and robotics, and tech. They have a computer lab with a 3D printer and coding gear.\n\nThey needed a custom PC for their tech lab and I got the call.\n\n### The brief\n\nA reliable, solid machine for creative work: music production with Pro Tools and GarageBand, 3D modelling, coding, and general studio use. Powerful but not overkill. Quiet. Within a nonprofit budget.\n\n### What I did\n\n- Spec'd, sourced, built, and deployed on site\n- Quiet fans and solid case since young people work nearby\n- No overclocking, everything tested and stable\n- Clean cables, labelled connections, documentation for staff\n\nThis one felt different. Usually builds are transactional. This machine was going into a space where it would directly support creative learning.\n\n[daydreammachine.co](https://daydreammachine.co)",
      year: 2025,
      tags: ["Hardware", "Consulting", "Project Management"],
      published: true,
      sortOrder: 2,
    },
    {
      slug: "this-website",
      title: "This website",
      summary: "Full stack Next.js personal site with a contact API, project showcase, and blog CMS. Built by AI agents from a written spec.",
      descriptionMd: "## This website\n\nA full stack Next.js personal website built from a written specification using AI agents.\n\n### Stack\n\n- Next.js 15, TypeScript, Tailwind CSS, Motion (Framer Motion v12+)\n- Prisma ORM, PostgreSQL (Neon), Next.js API routes\n- bcrypt password verification, JWT session cookies (jose)\n- Resend for contact form delivery\n- react-markdown for blog content\n\n### Features\n\n- Project showcase from a database\n- Blog CMS with Markdown editing\n- Contact form with rate limiting, honeypot spam protection, email delivery\n- Admin dashboard\n- Canvas particle background, scroll animations, page transitions",
      year: 2025,
      tags: ["Next.js", "TypeScript", "Prisma", "PostgreSQL", "AI"],
      published: true,
      sortOrder: 3,
    },
  ];

  for (const p of projects) {
    await prisma.project.upsert({ where: { slug: p.slug }, update: p, create: p });
  }

  // --- PC Build Posts ---
  const builds = [
    { slug: "first-ever-pc-build", title: "My first ever PC build",
      excerpt: "Took apart the family PC. Intel Core i7 2600K. I had no idea what I was doing but when it POSTed I was hooked.",
      content: "It started with an Intel Core i7 2600K and a family PC that definitely did not need to be disassembled. But I took it apart anyway because I wanted to see how it all worked.\n\nI am pretty sure I forgot to plug in the front panel headers the first time. The power button did nothing and I panicked for about ten minutes before realising. When it finally POSTed though, that feeling is hard to explain. Like your first hit of something you know you will be doing for a long time.\n\nThe i7 2600K was already ancient by 2022 standards but that was actually good. Old hardware means you are not scared to break it. And I made plenty of mistakes. Forgot standoffs once. Applied thermal paste like I was frosting a cake. Each mistake taught me something.\n\nI did not know it yet but this was the start of everything.",
      date: "2022-06-01", image: "/images/first-ever-pc-build.jpg" },
    { slug: "xtreme-bean-brand-launch", title: "Xtreme Bean: the brand",
      excerpt: "March 2023. Officially launched the brand, designed a logo, started taking this seriously.",
      content: "By early 2023 I had built enough PCs to know this was not just a phase. I needed an actual name.\n\nXtreme Bean had been my Steam gamer tag for years. I made it up on the spot when I created my Steam account about six years ago and it just sort of became my online identity. It was weird enough to be memorable and dumb enough to be funny. So I kept it.\n\nI designed a basic logo, set up a workflow, and started treating this like a real thing. Around this time I was averaging about one PC a week. Sourcing parts on Marketplace, testing components on my bench, meeting clients, delivering machines.\n\nThe photo from this time is one of my favourites. All the parts laid out on a table before the build. There is something really satisfying about seeing every component waiting to be assembled. The calm moment before you pick up the screwdriver.",
      date: "2023-03-01", image: "/images/parts-laid-out-for-build.jpg" },
    { slug: "first-satisfied-customer", title: "First satisfied customer",
      excerpt: "Building a PC for someone who paid you real money is terrifying. It booted first try. I felt unstoppable.",
      content: "Building for yourself is one thing. Building for someone who gave you actual money is completely different. The stakes feel way higher.\n\nThis was my first real customer. I do not remember the exact specs but I remember the anxiety. What if it does not POST. What if I forgot something. What if they hate it.\n\nIt booted first try. This does not always happen and when it does you feel like you can do anything.\n\nThe customer was really happy. They sent me a photo with the completed build and that photo became proof that I could actually do this. Word of mouth from that first customer led to more builds and eventually Xtreme Builds became a real thing. I still do not know why they took a chance on some kid with a screwdriver and a stupid gamer tag but I am glad they did.",
      date: "2023-06-01", image: "/images/satisfied-customer-with-pc.jpg" },
    { slug: "monster-energy-pc-build", title: "Monster Energy PC",
      excerpt: "January 2024. Saw cool builds on Instagram and decided to try my own. Green, black, and completely unnecessary.",
      content: "I kept seeing these wild themed builds on Instagram and wanted to try one myself. Monster Energy seemed like an obvious choice. Green and black colour scheme, aggressive look, everyone knows the logo.\n\nThis was just for fun, not a client request. I started with the case and worked outward. Green cable extensions. Custom fan setup. Monster branding wherever it made sense and probably a few places where it did not.\n\nThis build taught me that a PC can be more than just specs on a sheet. It can look cool too. The themed builds kind of became my thing after this one. People started asking for them.\n\nThe behind the scenes photo shows the back panel cable management which tells a very different story than the front.",
      date: "2024-01-01", image: "/images/monster-energy-pc.jpg" },
    { slug: "stock-market-pc-build", title: "Stock market themed PC",
      excerpt: "April 2024. A client wanted a PC that looked like a Bloomberg terminal. Custom request, very specific aesthetic.",
      content: "A client came to me with a very specific idea. They wanted their PC to look like a Bloomberg terminal had a baby with a gaming rig. Dark tones, clean lines, subtle lighting. Something professional enough for a home office but powerful enough to run multiple trading monitors.\n\nThis kind of build is my favourite. Someone has an idea that does not exist off the shelf and you figure out how to make it real. The constraints force you to be creative instead of just throwing parts together.\n\nAround this time I was also getting into 3D printing with the Ender E3 V3. Making custom case badges and cable combs. Small details that take a build from nice to someone's dream setup.\n\nThe stock market aesthetic was a fun challenge. Not as flashy as the Monster Energy one but way more precise.",
      date: "2024-04-01", image: "/images/stock-market-pc.jpg" },
    { slug: "hello-kitty-pc-build", title: "Hello Kitty PC",
      excerpt: "July 2024. Saw a pink case and knew I had to do something fun with it. Nobody asked for this. I did it anyway.",
      content: "Sometimes you see a component and your brain just goes: yep, we are doing something with that. That is what happened with the pink case. I saw it while sourcing parts and immediately knew I needed to build a Hello Kitty PC.\n\nNo one asked for this build. It was purely because I thought it would be fun and different and might make people smile. The challenge was finding the balance between Hello Kitty themed and actually a serious gaming PC that someone would want to use.\n\nThe final result was clean. Pink case, white components where I could, just enough theming to be obvious without being over the top. Sometimes the best builds are the ones nobody asked for.",
      date: "2024-07-01", image: "/images/hello-kitty-pc.jpg" },
    { slug: "xtreme-bean-phone-cases", title: "Xtreme Bean phone cases",
      excerpt: "Got a 3D printer and immediately started making branded phone cases for friends. The Ender taught me patience.",
      content: "Getting the Creality Ender E3 V3 opened up a whole new side of Xtreme Bean. I could make actual branded stuff.\n\nStarted with phone cases. Printed the Xtreme Bean logo, dialled in the settings, ran off a batch for friends. They were not perfect. Early 3D prints never are. But they were mine. The logo on an actual physical thing you could hold.\n\nThe Ender taught me patience. Bed levelling. Filament calibration. Print speeds. Temperature towers. 3D printing is half engineering and half superstition. You develop little rituals. You learn to read the first layer like tea leaves.\n\nBy 2025 I upgraded to a Bambu Labs P1S with AMS which was a massive jump. Multi colour prints, way faster speeds, so much less tinkering. But I am glad I started on the Ender. It teaches you the fundamentals the hard way and that is the only way they really stick.",
      date: "2024-08-01", image: "/images/xtreme-bean-phone-cases.jpg" },
    { slug: "rtx-2070-super-refurb", title: "RTX 2070 Super refurb",
      excerpt: "Picked up a crusty RTX 2070 Super on Facebook Marketplace. Cleaned it, repasted it, gave it a second life.",
      content: "Facebook Marketplace was the backbone of my early builds. You can get great hardware cheap if you are willing to clean it up and deal with the occasional dud.\n\nThis RTX 2070 Super was a classic Marketplace find. The seller's photos were rubbish. The card was dusty. The thermal paste was basically dried up chalk. But the price was right and I had done this enough times to know what a deep clean and fresh paste could do.\n\nTook the whole cooler apart. Cleaned the GPU die and PCB with isopropyl alcohol. Fresh Arctic MX-4 paste. Blew all the dust out of the heatsink fins and fan blades. Put it back together and ran some thermal tests.\n\nIdle temps dropped about 8 degrees. Load temps dropped over 12. A crusty Marketplace card became someone's reliable GPU.\n\nThis was basically a third of my 110 plus builds. Refurbished parts kept costs down and gave perfectly good hardware a second life. You get really good at cleaning other people's dust out of graphics cards.",
      date: "2024-10-01", image: "/images/rtx-2070-thermal-paste-repair.jpg" },
    { slug: "iranian-monster-fruit-leather", title: "Iranian Monster fruit leather",
      excerpt: "December 2024. These are not PC parts. They are incredible Iranian fruit leather bars and they deserve to be documented.",
      content: "These are Iranian Monster brand fruit leather bars and they are genuinely excellent. Not PC related at all but I am putting them in the timeline anyway.\n\nFound these through family. Iranian fruit leather (lavashak) is a traditional snack and this brand absolutely nailed the texture. The packaging is great too. Monster branding that has nothing to do with Monster Energy but I find the name coincidence funny given the Monster Energy PC build from earlier that year.\n\nNot everything has to be a project or a build log. Sometimes it is just really good fruit leather and you want to remember where to find it again.",
      date: "2024-12-01", image: "/images/iranian-monster-fruit-leather.jpg" },
    { slug: "daydream-machine-custom-pc", title: "Daydream Machine custom PC",
      excerpt: "Early 2025. Custom build for a Canberra creative learning studio. This one felt different from the usual jobs.",
      content: "Daydream Machine is a creative learning studio in Fyshwick for neurodivergent young people aged 9 to 21. They do music, art, LEGO and robotics, and tech programs. Founded by Luke Ferguson who was the 2022 ACT Local Hero. They needed a PC for their tech lab.\n\nThe brief was straightforward. A reliable machine for creative workflows: music production, 3D modelling, coding, general use. Powerful but not ridiculous. Quiet. Within a nonprofit budget.\n\nI spec'd it, built it, and set it up on site. Working with a studio that supports neurodivergent kids meant actually thinking about things like noise levels and cable safety. No overclocking. Everything tested properly. Wrote up documentation so their staff could maintain it.\n\nThis one felt good. Most builds are just transactions. This machine was going into a space where it would help kids learn and create.\n\n[daydreammachine.co](https://daydreammachine.co)",
      date: "2025-02-01", image: "/images/daydream-machine-pc.jpg" },
    { slug: "physics-dc-motor-project", title: "The DC motor that melted itself",
      excerpt: "April 2025. Built a working DC motor for physics class. It worked great. Then the hot glue melted.",
      content: "Physics project. Build a DC motor from scratch. Copper wire, magnets, a battery, and something to hold the whole thing together. I used hot glue. This turned out to be a mistake.\n\nThe motor actually worked. It spun. I was genuinely proud of it for about thirty seconds.\n\nThen the commutator got warm. Which is normal for DC motors. Except hot glue does not like heat. That is literally its whole thing. It melts when hot.\n\nThe commutator warmed up enough to soften the glue holding the assembly together. It sagged. It shorted. It stopped. I watched my working motor slowly destroy itself in real time.\n\nGood lesson though. Hot glue and copper commutators are not friends. Also I passed the assignment because the motor did work before it melted. The video and still image show it both working and the aftermath.",
      date: "2025-04-01", image: "/images/physics-dc-motor-still.jpg" },
    { slug: "cpu-in-banana-bread-batter", title: "CPU in banana bread batter",
      excerpt: "Friend kept asking if his CPU had arrived. So I put it in banana bread batter and sent him this photo.",
      content: "A friend was waiting on a CPU for his custom build. He had been messaging me constantly. Is it here yet. Has it arrived. Where is it. You know the type.\n\nSo I took his CPU and gently placed it into a bowl of banana bread batter. Took a photo. Sent it to him.\n\nThe reaction was exactly what I wanted. Confusion. Then laughter. Then relief that I was joking and the CPU was fine. The CPU got cleaned thoroughly with isopropyl alcohol before installation. The banana bread turned out great.\n\nSometimes the best photos in your camera roll come from the dumbest ideas. This is one of my favourite photos I have ever taken.",
      date: "2025-04-15", image: "/images/cpu-in-banana-bread-batter.jpg" },
    { slug: "build-2-showcase-2025", title: "Build 2 showcase",
      excerpt: "July 2025. One of the last builds before the water cooled project took over my bench. Clean, simple, satisfying.",
      content: "By mid 2025 I was deep in the rhythm. About one PC a week for two years straight. This was one of the showcase builds from that period.\n\nI wish I had written down the specs but honestly by this point the builds were coming fast enough that I stopped documenting every single one. What I remember is the feeling. Confident. Efficient. Like I actually knew what I was doing.\n\nAfter over a hundred PCs the process becomes automatic. Motherboard in first. PSU cables pre routed. Drives mounted. GPU last. You stop needing to look up front panel pinouts because your fingers just know the pattern. You learn which cases are a joy to work in and which ones will make you want to quit.\n\nThis build was one of the good cases. Clean and straightforward. Not every PC needs a big story behind it.",
      date: "2025-07-01", image: "/images/pc-build-2-2025.jpg" },
    { slug: "first-water-cooled-build", title: "First water cooled build",
      excerpt: "October 2025. Terrifying and expensive and absolutely not worth it for performance alone. Great learning experience though.",
      content: "Water cooling involves putting liquid inside a computer on purpose. Every instinct says this is wrong. But I wanted to learn.\n\nHonest review: it is hard, it is expensive, and for the performance gains alone it is completely not worth it. A good air cooler gets you 90 percent of the way there for way less money and zero fear of a leak destroying everything.\n\nBut I got a really good deal on the parts so I went for it.\n\nSoft tubing is your friend on a first build. Hard tubing looks amazing but you do not need that complexity when you are learning. Leak testing is not optional. Run the pump for 24 hours with the system off and paper towels under every fitting. The anxiety during that 24 hours is worse than any actual leak.\n\nThe filling process is actually kind of nice. Watching the liquid slowly work through the loop, chasing air bubbles, topping up the reservoir. Weirdly meditative.\n\nWould I do it again? For a special build maybe. For every build? No chance.",
      date: "2025-10-01", image: "" },
    { slug: "cpu-box-collection", title: "The CPU box collection",
      excerpt: "Started keeping CPU boxes and ended up with a whole shelf of them. Also Up and Go was a dollar a pack once.",
      content: "At some point I started keeping the CPU boxes. Not intentionally. I just did not throw one away. Then another. Then suddenly I had a bookshelf full.\n\nEach box is a build. An i7 here, a Ryzen there, a few generations of Intel and AMD stacked up over the years. The collection tells the story better than any spreadsheet. You can see the era when everyone wanted Ryzen 5 3600s. The period when i5 12400Fs were the value pick. The random Celeron from that one cheap office build.\n\nAlso on the shelf: Up and Go breakfast drinks. I bought a ridiculous amount when they were on sale for about a dollar a pack. The photo has both collections. CPU boxes above, Up and Go below. It is not glamorous but it is real.\n\nLate 2025 in Canberra. Over 110 builds done and the shelf had earned its place.",
      date: "2025-11-01", image: "/images/bookshelf-cpu-boxes.jpg" },
  ];

  // --- Cooking ---
  const cooking = [
    { slug: "homemade-pizza", title: "Homemade pizza",
      excerpt: "Made pizza from scratch. Not tweezers food. Just good.",
      content: "I mostly cook to eat. I am not plating things with tweezers. But homemade pizza always feels worth the effort.\n\nThis one came out particularly well. Good colour on the crust, cheese actually melted properly, toppings spread out instead of all dumped in the middle. The photo does not capture how good the kitchen smelled.\n\nNo formal recipe. The dough is a feel it out situation and toppings were whatever was in the fridge. That is the kind of cooking I actually enjoy. Adaptable, hard to mess up unless you burn it.",
      image: "/images/homemade-pizza.jpg" },
    { slug: "homemade-lasagna", title: "Homemade lasagna",
      excerpt: "Lasagna is a project. You do not make it on a weeknight. Worth the mess though.",
      content: "Lasagna is a commitment. You plan for it. You clear an afternoon. You accept that your kitchen will look like a disaster zone by the time it goes in the oven.\n\nThe layering is the best part. Sauce, pasta, cheese, repeat. Each layer matters. Too much sauce and it is soup. Too little and it is dry. The sweet spot only comes from trial and error.\n\nThis one was a classic meat lasagna with bechamel and mozzarella. The photo caught it mid build with the layers visible and the cheese waiting to melt. Came out of the oven bubbling and golden. Ate way too much of it. Worth it.",
      image: "/images/homemade-lasagna.jpg" },
    { slug: "fresh-pasta-dough", title: "Fresh pasta dough",
      excerpt: "Eggs in flour. The oldest recipe around and still one of the best.",
      content: "There is something cool about making pasta from absolute scratch. Flour on the bench, eggs cracked into a little well, working the dough with your fingers until it comes together. People have been doing exactly this for centuries.\n\nI am not some pasta expert. The dough was sticky at first, then too dry, then suddenly perfect. That is how dough works. It goes from this is wrong to actually this is fine to oh no I added too much flour in about ninety seconds.\n\nThe photo shows the flour well with eggs right before the mess starts. My favourite stage. All potential, no mistakes yet.\n\nRolled it out, cut it into something resembling fettuccine, boiled it, ate it with butter and parmesan. Simple and good.",
      image: "/images/fresh-pasta-dough.jpg" },
    { slug: "banana-bread", title: "Banana bread",
      excerpt: "The banana bread that did NOT have a CPU in it. Just to be clear.",
      content: "Just regular banana bread. No computer parts involved whatsoever.\n\nHad some bananas going brown on the counter and the only correct response to that situation is banana bread. The batter came together well. Mashed bananas, wet ingredients mixed, dry ingredients folded in gently because overmixing banana bread is genuinely a crime against baked goods.\n\nPhoto is from right before it went in the oven. Top is smooth. Batter looks promising. Zero CPUs present.\n\nIt turned out moist with a good crumb. Toasted with butter the next morning was even better. Banana bread always tastes better the day after you make it and I do not know why that is.",
      image: "/images/banana-bread.jpg" },
    { slug: "blueberry-muffins", title: "Blueberry muffin batter",
      excerpt: "The batter tastes almost as good as the finished thing. Almost.",
      content: "Blueberry muffins are dangerous because the batter is basically as good as the baked muffins.\n\nKey thing with muffins is do not overmix. The batter should be lumpy. Smooth batter means tough muffins. It is one of those baking rules that feels wrong but is absolutely correct. I folded the blueberries in last and tried not to crush them. Some still sink to the bottom during baking. That is just what blueberries do.\n\nThe photo is the batter stage because honestly batter photos do not get enough love. Everyone posts the finished muffin. Show me what it looked like before.",
      image: "/images/blueberry-muffin-batter.jpg" },
    { slug: "cinnamon-scrolls", title: "Cinnamon scrolls",
      excerpt: "Ready for the oven. Cinnamon scrolls make your whole house smell incredible.",
      content: "Cinnamon scrolls (or cinnamon rolls, whichever you call them) are one of those things that fill your entire house with the best possible smell.\n\nThe dough takes a while. Yeast, kneading, rising, punching down, rolling out. But once you have got your rectangle of dough the fun part starts. Butter spread across the whole thing. Cinnamon sugar on top. Roll it up tight. Slice into rounds. Arrange in a pan.\n\nThese are photographed right before going into the oven. You can see the spiral and the filling. They puffed up nicely and got a basic glaze on top.\n\nI do not bake that often but when I do it is usually something like this. An afternoon project that ends with something warm and sweet.",
      image: "/images/cinnamon-scrolls.jpg" },
    { slug: "chocolate-chip-cookies", title: "Gooey chocolate chip cookies",
      excerpt: "Ate one straight out of the oven and burned my mouth. Worth it.",
      content: "These came out of the oven and I immediately ate one, burning my mouth in the process. No regrets.\n\nA good chocolate chip cookie has a few things going on. Crispy edge. Chewy middle. Pockets of melted chocolate. Just enough salt so it is not all sweet. I do not follow an exact recipe. I mess with the butter to flour ratio by feel and always add more vanilla than the recipe says.\n\nThe photo caught them still warm on the tray. You can see the gooey chocolate and the golden edges. Those first five minutes out of the oven are when cookies are at their absolute best. They firm up as they cool but honestly most of them did not survive long enough to cool down fully.\n\nMade about two dozen. They lasted three days.",
      image: "/images/chocolate-chip-cookies.jpg" },
    { slug: "homemade-raisin-toast", title: "Raisin toast with peanut butter",
      excerpt: "Sometimes the simplest things are exactly what you want.",
      content: "Not every food post needs to be a thing. This is just fresh raisin toast with peanut butter and honestly it was exactly what I wanted.\n\nThe bread was fresh. Raisin toast has this particular sweetness that works really well with the savoury depth of peanut butter. The combination does not get talked about enough. Everyone goes on about avocado toast but nobody mentions raisin toast with peanut butter. This is me mentioning it.\n\nMade it. Ate it. Would make it again. That is it. That is the whole story.",
      image: "/images/homemade-raisin-toast.jpg" },
  ];

  // --- Misc ---
  const misc = [
    { slug: "daihatsu-sirion-1999", title: "1999 Daihatsu Sirion",
      excerpt: "Yellow, tiny, manual. The car I learned stick in. Almost crashed into a tree. Sold it to a guy who turned it into a rally car.",
      content: "This was my 1999 Daihatsu Sirion. Bright yellow. Tiny engine. Manual transmission. The car that taught me how to drive stick.\n\nFirst time I drove it I nearly crashed into a tree in the neighbour's front yard. Learning manual is humbling. You stall at traffic lights. You jerk through gear changes. Every hill start feels like a gamble. But then one day it just clicks and you can shift without thinking about it.\n\nI sold it eventually. The guy who bought it turned it into a rally car. A rally car. The little yellow Sirion that could barely make it up my driveway without stalling went on to race on dirt tracks. I like to think I gave it the basics and it went on to achieve its potential.\n\nThe Sirion is gone now but I will always remember it. First car, first crash narrowly avoided, first time I really understood how a machine works from the inside.",
      image: "/images/daihatsu-sirion-engine-bay.jpg" },
    { slug: "mitski-poster-arabic", title: "Mitski poster in Arabic",
      excerpt: "I like Mitski and this poster is really cool.",
      content: "Found this Mitski poster with Arabic typography and had to get it. The design is really striking. The script works beautifully with the composition and it is different from any other band poster I have seen.\n\nMitski's music has been a constant for me for years. There is a rawness to her writing that cuts through no matter what language you speak. But seeing her name in Arabic script adds another layer. Representation matters in small ways too. A poster on a wall. A name in your own alphabet.\n\nNot everything needs a deep analysis. I like Mitski. I think this poster is really cool. That is it.",
      image: "/images/mitski-poster-arabic.jpg" },
  ];

  // Insert all posts
  for (const b of builds) {
    await prisma.post.upsert({
      where: { slug: b.slug },
      update: {
        title: b.title, excerpt: b.excerpt, contentMd: b.content,
        coverImage: b.image || null, tags: ["pc-build"],
        date: b.date ? new Date(b.date) : null, published: true,
      },
      create: {
        slug: b.slug, title: b.title, excerpt: b.excerpt, contentMd: b.content,
        coverImage: b.image || null, tags: ["pc-build"],
        date: b.date ? new Date(b.date) : null, published: true,
      },
    });
  }

  for (const c of cooking) {
    await prisma.post.upsert({
      where: { slug: c.slug },
      update: {
        title: c.title, excerpt: c.excerpt, contentMd: c.content,
        coverImage: c.image || null, tags: ["cooking"],
        date: null, published: true,
      },
      create: {
        slug: c.slug, title: c.title, excerpt: c.excerpt, contentMd: c.content,
        coverImage: c.image || null, tags: ["cooking"],
        date: null, published: true,
      },
    });
  }

  for (const m of misc) {
    await prisma.post.upsert({
      where: { slug: m.slug },
      update: {
        title: m.title, excerpt: m.excerpt, contentMd: m.content,
        coverImage: m.image || null, tags: ["misc"],
        date: null, published: true,
      },
      create: {
        slug: m.slug, title: m.title, excerpt: m.excerpt, contentMd: m.content,
        coverImage: m.image || null, tags: ["misc"],
        date: null, published: true,
      },
    });
  }

  // Original launch post
  await prisma.post.upsert({
    where: { slug: "why-i-study-law-and-computing" },
    update: { tags: [] },
    create: {
      slug: "why-i-study-law-and-computing",
      title: "Why I study law and computing at the same time",
      excerpt: "Most people pick one. I could not, because the questions I find interesting sit exactly between the two.",
      contentMd: "Most people pick one. I could not, because the questions I find interesting sit exactly between the two.\n\nWho is liable when a model gives bad advice? What does explainability mean when a statute demands reasons for a decision? How do you regulate a system whose behaviour its own developers cannot fully predict?\n\nWorking in a pharmacy makes this concrete. Every script I help dispense moves through a chain of regulation: scheduling, storage, recording, counselling. The rules work because they were written for processes people can inspect. AI breaks that assumption, and the law is still catching up.\n\nThat gap is where I want to work. This blog tracks what I learn: case notes, AI regulation in Australia, and the occasional build log.",
      tags: [],
      date: null,
      published: true,
    },
  });

  console.log("Seed done: 3 projects, 15 builds, 8 cooking, 2 misc, 1 original");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
