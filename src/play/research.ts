import type { GameId } from "./simulated";

/* What sits behind each game: why the movement matters, how its
   numbers could serve a treatment trial, and the published work it
   draws on. Every paper here is real and linked to its PubMed entry;
   each `finding` says only what that paper's abstract says. */

export type Paper = {
  authors: string;
  year: number;
  title: string;
  journal: string;
  url: string;
  /* what it found, and why it's here */
  finding: string;
};

export type Research = {
  why: string;
  trial: { title: string; body: string }[];
  papers: Paper[];
};

const pubmed = (id: number) => `https://pubmed.ncbi.nlm.nih.gov/${id}/`;

const LOWES_2024: Paper = {
  authors: "Lowes LP, Alfano LN, et al.",
  year: 2024,
  title: "Validity of remote live stream video evaluation of the North Star Ambulatory Assessment in patients with Duchenne muscular dystrophy",
  journal: "PLoS One",
  url: pubmed(38753764),
  finding:
    "Compared North Star scores, including time to rise from the floor, taken over live video at home with the same assessment in clinic, in boys aged 4 to 7 taking part in gene therapy trials.",
};

export const RESEARCH: Record<GameId, Research> = {
  "chair-rise": {
    why: "Standing up from a chair works the hip and thigh muscles that Duchenne weakens early. How many full stands someone manages in 30 seconds, and how long each takes, tracks lower-body strength.",
    trial: [
      {
        title: "Each participant is their own baseline",
        body: "The first weeks of sessions set where each person starts. A trial then compares how far the treated and placebo groups move from their own baselines.",
      },
      {
        title: "Many readings instead of a few",
        body: "A clinic test is one attempt on one day. Sessions most days average out good days and bad ones, so a smaller real change can stand out from the noise.",
      },
      {
        title: "Failed attempts kept apart",
        body: "Rises that sink back are recorded separately from full stands, so a study can test whether they shift before the count does.",
      },
      {
        title: "Bad recordings can't pass as results",
        body: "A session that fails a recording check is held back until a person looks at it, so a poorly framed video can't look like a treatment failing.",
      },
    ],
    papers: [
      {
        authors: "Jones CJ, Rikli RE, Beam WC",
        year: 1999,
        title: "A 30-s chair-stand test as a measure of lower body strength in community-residing older adults",
        journal: "Research Quarterly for Exercise and Sport",
        url: pubmed(10380242),
        finding: "The original 30-second chair stand test, validated in older adults. Rise adapts its timing and its count of full stands.",
      },
      {
        authors: "McDonald CM, Henricson EK, et al.",
        year: 2013,
        title: "The 6-minute walk test and other clinical endpoints in Duchenne muscular dystrophy: reliability, concurrent validity, and minimal clinically important differences",
        journal: "Muscle & Nerve",
        url: pubmed(23674289),
        finding: "Measured how reliable Duchenne trial endpoints are and how big a change has to be to matter: the yardstick any new measure has to meet.",
      },
      LOWES_2024,
    ],
  },

  "floor-rise": {
    why: "Rising from the floor is one of the timed items of the North Star Ambulatory Assessment, built for boys with Duchenne. As hip muscles weaken, boys often push on their thighs to get upright: a Gowers' manoeuvre, one of the condition's classic signs.",
    trial: [
      {
        title: "Already a trial endpoint",
        body: "The pivotal trial of vamorolone used how quickly boys stood up from the floor as its primary outcome. The same measure, taken at home, could fill in the months between visits.",
      },
      {
        title: "How, not just how fast",
        body: "Time spent pushing on the legs, and where the rise slowed, are kept alongside the time, so a study can look at how someone stands as well as how quickly.",
      },
      {
        title: "Video can be scored reliably",
        body: "Rise time scored from video has agreed closely with the same test in clinic, which is what makes an automatic version worth testing.",
      },
      {
        title: "Not getting up is a result too",
        body: "A rise that doesn't reach standing in 30 seconds is recorded as not completed, rather than dropped, so loss of the ability shows in the data.",
      },
    ],
    papers: [
      {
        authors: "Mazzone E, Martinelli D, et al.",
        year: 2010,
        title: "North Star Ambulatory Assessment, 6-minute walk test and timed items in ambulant boys with Duchenne muscular dystrophy",
        journal: "Neuromuscular Disorders",
        url: pubmed(20634072),
        finding: "In 112 boys, time to rise from the floor ranged from 1 to 27.5 seconds, and some could not rise at all: the range Floor rise has to cover.",
      },
      {
        authors: "Guglieri M, Clemens PR, et al.",
        year: 2022,
        title: "Efficacy and safety of vamorolone vs placebo and prednisone among boys with Duchenne muscular dystrophy: a randomized clinical trial",
        journal: "JAMA Neurology",
        url: pubmed(36036925),
        finding: "Its primary endpoint was the change in time-to-stand velocity over 24 weeks: rising from the floor, used to decide whether a drug works.",
      },
      {
        authors: "Emery N, Strachan K, et al.",
        year: 2022,
        title: "Evaluating the feasibility and reliability of remotely delivering and scoring the North Star Ambulatory Assessment in ambulant patients with Duchenne muscular dystrophy",
        journal: "Children",
        url: pubmed(35626905),
        finding: "In ten boys, two physiotherapists scoring from video agreed on rise time almost perfectly (intraclass correlation 1.00).",
      },
      LOWES_2024,
    ],
  },

  tap: {
    why: "Finger tapping is item 3.4 of the MDS-UPDRS motor exam for Parkinson's. A clinician watches how fast and how wide the taps are, and whether they slow, shrink or stall as they go on: the signs of bradykinesia.",
    trial: [
      {
        title: "A rating becomes a measurement",
        body: "Instead of a 0 to 4 score given by eye, each session yields taps a second, how even the rhythm is and how much the taps fade, measured the same way every time.",
      },
      {
        title: "Readings between visits",
        body: "Parkinson's symptoms vary through the day and between doses. Short sessions at home show that variation, which a single clinic visit can't.",
      },
      {
        title: "Run alongside the standard scale",
        body: "Phone-based tapping has been run next to standard ratings as an exploratory endpoint in a phase 3 trial. That is the role a measure like this would start in.",
      },
      {
        title: "Bad recordings can't pass as results",
        body: "Sessions where the hand left the frame or the video ran too slowly to count fast taps are flagged rather than scored as if nothing were wrong.",
      },
    ],
    papers: [
      {
        authors: "Goetz CG, Tilley BC, et al.",
        year: 2008,
        title: "Movement Disorder Society-sponsored revision of the Unified Parkinson's Disease Rating Scale (MDS-UPDRS): scale presentation and clinimetric testing results",
        journal: "Movement Disorders",
        url: pubmed(19025984),
        finding: "The rating scale Parkinson's trials use, including the finger-tapping item Tap mirrors.",
      },
      {
        authors: "Heye K, Li R, et al.",
        year: 2024,
        title: "Validation of computer vision technology for analyzing bradykinesia in outpatient clinic videos of people with Parkinson's disease",
        journal: "Journal of the Neurological Sciences",
        url: pubmed(39476714),
        finding: "Computer vision analysis of finger-tapping videos classified Parkinson's with 91% sensitivity and 97% specificity, more accurately than the clinical raters.",
      },
      {
        authors: "Page A, Yung N, et al.",
        year: 2022,
        title: "A smartphone application as an exploratory endpoint in a phase 3 Parkinson's disease clinical trial: a pilot study",
        journal: "Digital Biomarkers",
        url: pubmed(35224425),
        finding: "Smartphone measures of bradykinesia correlated modestly with standard outcomes and agreed with the trial's overall finding that the drug had no benefit.",
      },
    ],
  },

  reach: {
    why: "Lifting an arm out to the side and overhead works the shoulder muscles. In Duchenne, arm function matters most once walking is lost, and shoulder range is a common measure in rehabilitation more widely.",
    trial: [
      {
        title: "Each arm, every session",
        body: "The highest angle each shoulder reaches is kept for every session, showing whether range is held, gained or lost over a trial.",
      },
      {
        title: "Left and right kept apart",
        body: "A change on one side, after a stroke or a treatment given to one limb, isn't averaged away by the other.",
      },
      {
        title: "Participants who no longer walk stay in",
        body: "Upper-limb measures let a trial keep following participants after they stop walking, instead of losing them from the outcome.",
      },
    ],
    papers: [
      {
        authors: "Mayhew A, Mazzone ES, et al.",
        year: 2013,
        title: "Development of the Performance of the Upper Limb module for Duchenne muscular dystrophy",
        journal: "Developmental Medicine & Child Neurology",
        url: pubmed(23902233),
        finding: "The upper-limb scale built for Duchenne, for boys who still walk and those who no longer do, following how arm weakness progresses.",
      },
      {
        authors: "Han JJ, Kurillo G, et al.",
        year: 2015,
        title: "Upper extremity 3-dimensional reachable workspace analysis in dystrophinopathy using Kinect",
        journal: "Muscle & Nerve",
        url: pubmed(25597487),
        finding: "A consumer depth camera measured how far 43 people with Duchenne or Becker muscular dystrophy could reach, capturing arm impairment in those who walk and those who don't: the same idea as Reach, with a different camera.",
      },
    ],
  },
};

/* for every game: how regulators expect a remote measure to be shown fit for a trial */
export const GUIDANCE = {
  title: "Digital Health Technologies for Remote Data Acquisition in Clinical Investigations",
  source: "US Food and Drug Administration, guidance for industry",
  url: "https://www.fda.gov/regulatory-information/search-fda-guidance-documents/digital-health-technologies-remote-data-acquisition-clinical-investigations",
};
