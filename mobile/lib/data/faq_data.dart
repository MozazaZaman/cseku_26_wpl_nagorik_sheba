class FaqItem {
  final String category;
  final String question;
  final String answer;
  const FaqItem({required this.category, required this.question, required this.answer});
}

class FaqData {
  static const en = <FaqItem>[
    FaqItem(
      category: 'Getting started',
      question: 'How do I report an issue?',
      answer:
          'Tap the Report button (bottom), choose GPS or Custom Address, add a title, description and optionally a photo. Five AI agents then verify, classify, de-duplicate, prioritize and route your report to the correct authority — anywhere in Bangladesh.',
    ),
    FaqItem(
      category: 'Getting started',
      question: 'Do I need an account to report or vote?',
      answer:
          'Browsing issues and finding emergency services need no account. Reporting, voting and tracking require a free account — registration uses face verification (a selfie + ID photo compared by our Photo Verifier Agent).',
    ),
    FaqItem(
      category: 'Account',
      question: 'Why do I need to take a selfie and an ID photo?',
      answer:
          'One account per real citizen. The Photo Verifier Agent compares your live selfie with your NID / Student ID / Passport photo. If the faces do not match, registration is rejected.',
    ),
    FaqItem(
      category: 'Account',
      question: 'I forgot my password — what do I do?',
      answer:
          'On the login screen tap "Forgot password". We email a 6-digit code; verify it and set a new password. The code expires in 10 minutes.',
    ),
    FaqItem(
      category: 'Voting',
      question: 'Why did my report become a vote?',
      answer:
          'Agent 03 (Duplicate Checker) scans a 250 m radius. If a similar report already exists, yours is merged into it as a vote instead of creating a duplicate — votes raise the priority score.',
    ),
    FaqItem(
      category: 'Voting',
      question: 'Why is voting locked on some issues?',
      answer:
          'Once an authority starts solving a problem (assigned / in process), voting is locked. You will be notified of status updates instead.',
    ),
    FaqItem(
      category: 'Pipeline',
      question: 'What do the 5 agents do?',
      answer:
          '1) Photo Verifier rejects spam/invalid media. 2) Classifier tags road/electricity/water/gas/sanitation (Bangla + English). 3) Duplicate Checker merges reports within 250 m. 4) Priority Ranker scores votes, severity keywords and freshness. 5) Destination Router sends it to the right city corporation / pourashova / union parishad.',
    ),
    FaqItem(
      category: 'Pipeline',
      question: 'How is priority calculated?',
      answer:
          'score = votes × 4 + severity hits × 12 + freshness bonus (decays over 7 days), capped at 100. Severe keywords like "accident", "fire", "electrocution", "শিশু" boost the score.',
    ),
    FaqItem(
      category: 'Resolution',
      question: 'How long does resolution take?',
      answer:
          'Each stage has an SLA (junior 3 days, senior 3, mayor 5, WIT 2, execution 7), tightened for high-priority issues. Overdue items auto-escalate to the next stage and notify the responsible officer.',
    ),
    FaqItem(
      category: 'Resolution',
      question: 'Can I rate the authority after my issue is solved?',
      answer:
          'Yes. When your complaint is resolved, rate it 1–5 with an optional comment. Mayors see aggregated satisfaction on their reviews page. If the problem is not actually fixed, you can reopen it for re-inspection.',
    ),
    FaqItem(
      category: 'Staff',
      question: 'I am staff — what can I do in the app?',
      answer:
          'Sign in with your staff account to see your authority\'s priority queue. Take workflow actions for your role (junior → senior → mayor → WIT → field), earn achievement badges, and (for mayors) read citizen reviews and commend your team.',
    ),
    FaqItem(
      category: 'Emergency',
      question: 'How do I find emergency services without logging in?',
      answer:
          'Open Emergency Nearby — fire service, police, WASA, LGED, DESA, Titas gas and public toilets around your GPS location, with distances, phone numbers and directions. Nationwide, no account needed.',
    ),
  ];

  static const bn = <FaqItem>[
    FaqItem(
      category: 'শুরু করা',
      question: 'আমি কীভাবে সমস্যা জানাব?',
      answer:
          'নিচের রিপোর্ট বোতাম চাপুন, জিপিএস বা নিজের ঠিকানা বাছুন, শিরোনাম, বিবরণ এবং ঐচ্ছিক ছবি দিন। এরপর ৫টি এআই এজেন্ট আপনার রিপোর্ট যাচাই, শ্রেণীবিন্যাস, ডুপ্লিকেট-নিরসন, অগ্রাধিকার ও সঠিক কর্তৃপক্ষে রাউটিং করবে — বাংলাদেশের যেকোনো জায়গায়।',
    ),
    FaqItem(
      category: 'শুরু করা',
      question: 'রিপোর্ট বা ভোটের জন্য কি অ্যাকাউন্ট লাগে?',
      answer:
          'সমস্যাবলি দেখা ও জরুরি সেবা খোঁজার জন্য কোনো অ্যাকাউন্ট লাগে না। রিপোর্ট, ভোট ও ট্র্যাকিংয়ের জন্য একটি ফ্রি অ্যাকাউন্ট লাগে — নিবন্ধনে ফেস যাচাই (সেলফি + আইডি ছবি, ছবি যাচাইকারী এজেন্ট তুলনা করে) হয়।',
    ),
    FaqItem(
      category: 'অ্যাকাউন্ট',
      question: 'সেলফি ও আইডির ছবি কেন লাগে?',
      answer:
          'একজন প্রকৃত নাগরিকের জন্য একটি অ্যাকাউন্ট। ছবি যাচাইকারী এজেন্ট আপনার সেলফি ও জাতীয় পরিচয়পত্র / ছাত্র আইডি / পাসপোর্টের ছবির মুখ তুলনা করে। মুখ না মিললে নিবন্ধন বাতিল হয়।',
    ),
    FaqItem(
      category: 'অ্যাকাউন্ট',
      question: 'পাসওয়ার্ড ভুলে গেছি — এখন কী করব?',
      answer:
          'লগইন পাতায় "পাসওয়ার্ড ভুলে গেছেন" চাপুন। আমরা ইমেইলে একটি ৬-অঙ্কের কোড পাঠাব; কোড যাচাই করে নতুন পাসওয়ার্ড দিন। কোড ১০ মিনিটে মেয়াদোত্তীর্ণ হয়।',
    ),
    FaqItem(
      category: 'ভোট',
      question: 'আমার রিপোর্ট ভোট হয়ে গেল কেন?',
      answer:
          'এজেন্ট ০৩ (ডুপ্লিকেট যাচাইকারী) ২৫০ মিটারের মধ্যে খুঁজে। একই রকম রিপোর্ট থাকলে আপনারটি নতুন ডুপ্লিকেট না বানিয়ে মূল অভিযোগে ভোট হিসেবে যুক্ত হয় — ভোট অগ্রাধিকার বাড়ায়।',
    ),
    FaqItem(
      category: 'ভোট',
      question: 'কিছু অভিযোগে ভোট বন্ধ কেন?',
      answer:
          'কর্তৃপক্ষ একবার সমাধান শুরু করলে (নির্ধারিত / প্রক্রিয়াধীন) ভোট বন্ধ থাকে। এর বদলে আপনি স্ট্যাটাস আপডেটের বিজ্ঞপ্তি পাবেন।',
    ),
    FaqItem(
      category: 'পাইপলাইন',
      question: '৫টি এজেন্ট কী করে?',
      answer:
          '১) ছবি যাচাইকারী স্প্যাম/ভুল মিডিয়া বাতিল করে। ২) শ্রেণীবিন্যাসকারী রাস্তা/বিদ্যুৎ/পানি/গ্যাস/পরিচ্ছন্নতা ট্যাগ করে (বাংলা + ইংরেজি)। ৩) ডুপ্লিকেট যাচাইকারী ২৫০ মিটারের মধ্যে রিপোর্ট একীভূত করে। ৪) অগ্রাধিকার নির্ধারক ভোট, গুরুতর শব্দ ও নতুনত্ব দিয়ে স্কোর করে। ৫) গন্তব্য রাউটার সঠিক সিটি কর্পোরেশন / পৌরসভা / ইউনিয়ন পরিষদে পাঠায়।',
    ),
    FaqItem(
      category: 'পাইপলাইন',
      question: 'অগ্রাধিকার কীভাবে হিসাব হয়?',
      answer:
          'স্কোর = ভোট × ৪ + গুরুতর শব্দ × ১২ + নতুনত্ব বোনাস (৭ দিনে কমে), সর্বোচ্চ ১০০। "দুর্ঘটনা", "আগুন", "শিশু" ইত্যাদি গুরুতর শব্দ স্কোর বাড়ায়।',
    ),
    FaqItem(
      category: 'সমাধান',
      question: 'সমাধানে কতদিন লাগে?',
      answer:
          'প্রতিটি ধাপে এসএলএ আছে (জুনিয়র ৩ দিন, সিনিয়র ৩, মেয়র ৫, পরিদর্শন ২, বাস্তবায়ন ৭), উচ্চ-অগ্রাধিকার সমস্যার জন্য ছোট। সময়মতো না হলে স্বয়ংক্রিয়ভাবে পরের ধাপে যায় এবং দায়িত্বপ্রাপ্তকে জানানো হয়।',
    ),
    FaqItem(
      category: 'সমাধান',
      question: 'আমার সমস্যা সমাধানের পর কি রেট দিতে পারব?',
      answer:
          'হ্যাঁ। আপনার অভিযোগ সমাধান হলে ১–৫ রেট ও ঐচ্ছিক মন্তব্য দিন। মেয়ররা তাদের রিভিউ পাতায় গড় সন্তুষ্টি দেখতে পান। সমস্যা আসলে ঠিক না হলে পুনরায় পরিদর্শনের জন্য খুলতে পারেন।',
    ),
    FaqItem(
      category: 'স্টাফ',
      question: 'আমি স্টাফ — অ্যাপে কী করতে পারব?',
      answer:
          'আপনার স্টাফ অ্যাকাউন্ট দিয়ে লগইন করলে কর্তৃপক্ষের অগ্রাধিকার কিউ দেখবেন। আপনার ভূমিকার (জুনিয়র → সিনিয়র → মেয়র → পরিদর্শন → ফিল্ড) ওয়ার্কফ্লো অ্যাকশন নিন, অর্জন ব্যাজ পান, এবং (মেয়রদের জন্য) নাগরিক রিভিউ পড়ে টিমকে প্রশংসা করুন।',
    ),
    FaqItem(
      category: 'জরুরি',
      question: 'লগইন ছাড়া জরুরি সেবা কীভাবে খুঁজব?',
      answer:
          'আশপাশের জরুরি সেবা খুলুন — আপনার জিপিএস অবস্থানের আশেপাশে ফায়ার সার্ভিস, পুলিশ, ওয়াসা, এলজিইডি, ডেসা, তিতাস গ্যাস ও পাবলিক টয়লেট — দূরত্ব, ফোন নম্বর ও দিকনির্দেশসহ। সারাদেশ, কোনো অ্যাকাউন্ট লাগে না।',
    ),
  ];
}
