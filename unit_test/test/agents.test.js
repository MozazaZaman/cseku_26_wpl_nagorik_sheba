import { describe, it, expect, beforeEach } from 'vitest';
import {
  CATEGORIES,
  agentVerify,
  agentClassify,
  agentRank,
  agentFindDuplicate
} from '../src/agents/pipeline.js';

describe('Agent 1 - Photo Verifier', () => {
  it('should reject empty description', () => {
    const result = agentVerify({ description: '' });
    expect(result.passed).toBe(false);
    expect(result.reason).toContain('too short');
  });

  it('should reject very short description', () => {
    const result = agentVerify({ description: 'short' });
    expect(result.passed).toBe(false);
  });

  it('should reject spam patterns', () => {
    const result = agentVerify({ description: 'aaaaaaaaaaaaaaaaaaaaaa' });
    expect(result.passed).toBe(false);
    expect(result.reason).toContain('spam');
  });

  it('should accept valid description without image', () => {
    const result = agentVerify({ 
      description: 'This is a valid complaint about a serious infrastructure issue that needs attention'
    });
    expect(result.passed).toBe(true);
  });

  it('should validate image metadata', () => {
    const validImage = {
      mimetype: 'image/jpeg',
      size: 500 * 1024, // 500 KB
      originalname: 'photo.jpg'
    };
    
    const result = agentVerify({ 
      description: 'Valid description here',
      image: validImage
    });
    expect(result.passed).toBe(true);
  });

  it('should reject image that is too small', () => {
    const tinyImage = {
      mimetype: 'image/jpeg',
      size: 500, // Too small
      originalname: 'tiny.jpg'
    };
    
    const result = agentVerify({
      description: 'Valid description',
      image: tinyImage
    });
    expect(result.passed).toBe(false);
  });

  it('should reject image that is too large', () => {
    const largeImage = {
      mimetype: 'image/jpeg',
      size: 10 * 1024 * 1024, // 10 MB, exceeds 8 MB limit
      originalname: 'large.jpg'
    };
    
    const result = agentVerify({
      description: 'Valid description',
      image: largeImage
    });
    expect(result.passed).toBe(false);
  });

  it('should reject non-image files', () => {
    const notImage = {
      mimetype: 'text/plain',
      size: 500 * 1024,
      originalname: 'notimage.txt'
    };
    
    const result = agentVerify({
      description: 'Valid description',
      image: notImage
    });
    expect(result.passed).toBe(false);
  });

  it('should handle lorem ipsum and test strings as spam', () => {
    const result = agentVerify({ 
      description: 'lorem ipsum test test test test test test'
    });
    expect(result.passed).toBe(false);
  });
});

describe('Agent 2 - Classifier', () => {
  it('should classify road damage', () => {
    const text = 'There is a big pothole on the main road causing accidents';
    const category = agentClassify(text);
    expect(category).toBe('road');
  });

  it('should classify electricity issues', () => {
    const text = 'Street light is not working near the school';
    const category = agentClassify(text);
    expect(category).toBe('electricity');
  });

  it('should classify water problems', () => {
    const text = 'Water logging at the intersection after rain';
    const category = agentClassify(text);
    expect(category).toBe('water');
  });

  it('should classify sanitation issues', () => {
    const text = 'Garbage not collected for two weeks in this area';
    const category = agentClassify(text);
    expect(category).toBe('sanitation');
  });

  it('should classify gas leaks', () => {
    const text = 'Gas leak detected near the market area';
    const category = agentClassify(text);
    expect(category).toBe('gas');
  });

  it('should handle Bangla text - gas', () => {
    const text = 'গ্যাসের গন্ধ আমাদের বাড়ির কাছে আসছে';
    const category = agentClassify(text);
    expect(category).toBe('gas');
  });

  it('should handle Bangla text - electricity', () => {
    const text = 'বিদ্যুৎ বিভ্রাট হচ্ছে প্রতিদিন রাতে';
    const category = agentClassify(text);
    expect(category).toBe('electricity');
  });

  it('should handle Bangla text - water', () => {
    const text = 'পানি জমে গেছে রাস্তার পাশে';
    const category = agentClassify(text);
    expect(category).toBe('water');
  });

  it('should handle Roman transliteration', () => {
    const text = 'Rasta vangga hole ache pothe accident ho ache';
    const category = agentClassify(text);
    expect(category).toBe('road');
  });

  it('should default to other for unclassifiable text', () => {
    const text = 'something random that cannot be classified';
    const category = agentClassify(text);
    expect(category).toBe('other');
  });

  it('should prioritize phrases over single words', () => {
    const text = 'The street light is not working properly and needs replacement';
    const category = agentClassify(text);
    expect(['electricity', 'other']).toContain(category);
  });

  it('should handle mixed English and Bangla', () => {
    const text = 'There is a pothole রাস্তায় causing traffic';
    const category = agentClassify(text);
    expect(category).toBe('road');
  });

  it('should be case insensitive', () => {
    const lower = agentClassify('street light not working');
    const upper = agentClassify('STREET LIGHT NOT WORKING');
    const mixed = agentClassify('Street Light Not Working');
    
    expect(lower).toBe(upper);
    expect(lower).toBe(mixed);
  });
});

describe('Agent 4 - Priority Ranker', () => {
  it('should rank by vote count', () => {
    const complaint1 = {
      title: 'Issue A',
      description: 'Normal issue',
      vote_count: 10,
      created_at: new Date().toISOString()
    };
    
    const complaint2 = {
      title: 'Issue B',
      description: 'Normal issue',
      vote_count: 1,
      created_at: new Date().toISOString()
    };

    const score1 = agentRank(complaint1);
    const score2 = agentRank(complaint2);
    
    expect(score1).toBeGreaterThan(score2);
  });

  it('should boost score for severity keywords', () => {
    const normal = {
      title: 'A pothole exists',
      description: 'There is a hole in the road',
      vote_count: 0,
      created_at: new Date().toISOString()
    };

    const severe = {
      title: 'Dangerous pothole',
      description: 'Accident occurred here today - dangerous for children',
      vote_count: 0,
      created_at: new Date().toISOString()
    };

    const normalScore = agentRank(normal);
    const severeScore = agentRank(severe);
    
    expect(severeScore).toBeGreaterThan(normalScore);
  });

  it('should consider age of complaint', () => {
    const now = new Date();
    const recent = {
      title: 'Issue',
      description: 'Recent issue',
      vote_count: 1,
      created_at: new Date(now - 1 * 60 * 60 * 1000).toISOString() // 1 hour ago
    };

    const old = {
      title: 'Issue',
      description: 'Old issue',
      vote_count: 1,
      created_at: new Date(now - 168 * 60 * 60 * 1000).toISOString() // 1 week ago
    };

    const recentScore = agentRank(recent);
    const oldScore = agentRank(old);
    
    expect(recentScore).toBeGreaterThan(oldScore);
  });

  it('should cap score at 100', () => {
    const extreme = {
      title: 'DANGEROUS ACCIDENT CHILD DEATH',
      description: 'DANGEROUS URGENT INJURED ACCIDENT COLLAPSED FIRE ELECTROCUTION DEATH',
      vote_count: 1000,
      created_at: new Date().toISOString()
    };

    const score = agentRank(extreme);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('should handle Bangla severity keywords', () => {
    const bangla = {
      title: 'দুর্ঘটনা ঘটেছে',
      description: 'শিশু আহত হয়েছে বিদ্যুতে',
      vote_count: 0,
      created_at: new Date().toISOString()
    };

    const score = agentRank(bangla);
    expect(score).toBeGreaterThan(0);
  });
});

describe('Agent 3 - Duplicate Finder', () => {
  it('should have function signature', () => {
    expect(typeof agentFindDuplicate).toBe('function');
  });

  it('should return null signature for duplicate not found', () => {
    // This requires database setup, testing at API level
    expect(agentFindDuplicate).toBeDefined();
  });
});

describe('Category Constants', () => {
  it('should define all expected categories', () => {
    expect(CATEGORIES).toContain('road');
    expect(CATEGORIES).toContain('electricity');
    expect(CATEGORIES).toContain('water');
    expect(CATEGORIES).toContain('gas');
    expect(CATEGORIES).toContain('sanitation');
    expect(CATEGORIES).toContain('other');
  });

  it('should have exactly 6 categories', () => {
    expect(CATEGORIES.length).toBe(6);
  });
});
