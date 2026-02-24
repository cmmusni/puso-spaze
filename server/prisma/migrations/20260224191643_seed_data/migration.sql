-- ─────────────────────────────────────────────
-- Seed data migration
-- Creates initial users, posts, and comments
-- ─────────────────────────────────────────────

-- Clear existing data (respecting foreign key constraints)
DELETE FROM comments;
DELETE FROM reactions;
DELETE FROM posts;
DELETE FROM users;
DELETE FROM invite_codes;

-- Create Users (Coach, Admin, Gen Z Community)
INSERT INTO users (id, "displayName", role, "createdAt") VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'sarah-coach', 'COACH', NOW()),
  ('550e8400-e29b-41d4-a716-446655440002', 'alex-admin', 'ADMIN', NOW()),
  ('550e8400-e29b-41d4-a716-446655440003', 'marcus', 'USER', NOW()),
  ('550e8400-e29b-41d4-a716-446655440004', 'emma-wellness', 'USER', NOW()),
  ('550e8400-e29b-41d4-a716-446655440005', 'jordan-seeker', 'USER', NOW()),
  ('550e8400-e29b-41d4-a716-446655440006', 'rachel-reflecting', 'USER', NOW()),
  ('550e8400-e29b-41d4-a716-446655440007', 'maya-vibes', 'USER', NOW()),
  ('550e8400-e29b-41d4-a716-446655440008', 'kai-authentic', 'USER', NOW()),
  ('550e8400-e29b-41d4-a716-446655440009', 'zara-creative', 'USER', NOW()),
  ('550e8400-e29b-41d4-a716-446655440010', 'sienna-brave', 'USER', NOW()),
  ('550e8400-e29b-41d4-a716-446655440011', 'leo-growth', 'USER', NOW()),
  ('550e8400-e29b-41d4-a716-446655440012', 'nova-starlight', 'USER', NOW()),
  ('550e8400-e29b-41d4-a716-446655440013', 'ash-honest', 'USER', NOW()),
  ('550e8400-e29b-41d4-a716-446655440014', 'sky-free', 'USER', NOW()),
  ('550e8400-e29b-41d4-a716-446655440015', 'river-flow', 'USER', NOW());

-- Create Posts (Original + Gen Z themed)
INSERT INTO posts (id, content, "userId", "createdAt", "moderationStatus", tags) VALUES
  ('650e8400-e29b-41d4-a716-446655440001', 'Struggling with work-life balance lately. Does anyone have tips for managing stress after long days?', '550e8400-e29b-41d4-a716-446655440003', NOW(), 'SAFE', '{"wellness","stress-management"}'),
  ('650e8400-e29b-41d4-a716-446655440002', 'Just finished my first week of meditation practice. Feeling more centered already! 🙏', '550e8400-e29b-41d4-a716-446655440004', NOW(), 'SAFE', '{"meditation","mindfulness"}'),
  ('650e8400-e29b-41d4-a716-446655440003', 'Grateful for the support from this community. It helps knowing I''m not alone in my journey.', '550e8400-e29b-41d4-a716-446655440005', NOW(), 'SAFE', '{"gratitude","community"}'),
  ('650e8400-e29b-41d4-a716-446655440004', 'Starting therapy today. Nervous but hopeful about taking this step for my mental health.', '550e8400-e29b-41d4-a716-446655440006', NOW(), 'SAFE', '{"mental-health","courage"}'),
  ('650e8400-e29b-41d4-a716-446655440005', 'As a coach, I believe small daily habits compound into big life changes. What''s one habit you''re proud of?', '550e8400-e29b-41d4-a716-446655440001', NOW(), 'SAFE', '{"coaching","habits","growth"}'),
  ('650e8400-e29b-41d4-a716-446655440006', 'Happy to announce we''ve reached 100 community members! Thank you all for being here.', '550e8400-e29b-41d4-a716-446655440002', NOW(), 'SAFE', '{"community","milestone"}'),
  ('650e8400-e29b-41d4-a716-446655440007', 'ngl the pressure to have it all figured out at 22 is insane 😭 like why are we expected to know our whole life plan already?', '550e8400-e29b-41d4-a716-446655440007', NOW(), 'SAFE', '{"gen-z","mental-health","anxiety"}'),
  ('650e8400-e29b-41d4-a716-446655440008', 'been working on being more authentically myself instead of who i think people want me to be. it''s scary but healing ✨', '550e8400-e29b-41d4-a716-446655440008', NOW(), 'SAFE', '{"authenticity","self-discovery","boundaries"}'),
  ('650e8400-e29b-41d4-a716-446655440009', 'anyone else struggle with comparing their behind-the-scenes to other people''s highlight reel? social media hits different lately', '550e8400-e29b-41d4-a716-446655440009', NOW(), 'SAFE', '{"social-media","self-worth","comparison"}'),
  ('650e8400-e29b-41d4-a716-446655440010', 'facing my trauma in therapy has been the most humbling and empowering thing i''ve done. healing is not linear and that''s okay 💜', '550e8400-e29b-41d4-a716-446655440010', NOW(), 'SAFE', '{"therapy","trauma","healing"}'),
  ('650e8400-e29b-41d4-a716-446655440011', 'why is it so hard to ask for help??? like we''re all struggling but we pretend we''re fine. let''s normalize vulnerability fr', '550e8400-e29b-41d4-a716-446655440011', NOW(), 'SAFE', '{"vulnerability","help","community"}'),
  ('650e8400-e29b-41d4-a716-446655440012', 'found this space and honestly it''s the first time i''ve felt like i can be 100% real without judgment. grateful for y''all 🤍', '550e8400-e29b-41d4-a716-446655440012', NOW(), 'SAFE', '{"safe-space","community","belonging"}'),
  ('650e8400-e29b-41d4-a716-446655440013', 'manifesting better mental health days for everyone reading this. you''re stronger than you think and your feelings are valid 💫', '550e8400-e29b-41d4-a716-446655440013', NOW(), 'SAFE', '{"affirmation","mental-health","support"}'),
  ('650e8400-e29b-41d4-a716-446655440014', 'learning that boundaries aren''t selfish, they''re necessary. setting them for the first time and it feels so liberating', '550e8400-e29b-41d4-a716-446655440014', NOW(), 'SAFE', '{"boundaries","self-care","growth"}'),
  ('650e8400-e29b-41d4-a716-446655440015', 'dealing with anxiety about the future but trying to stay present. some days are harder than others and that''s valid 🌊', '550e8400-e29b-41d4-a716-446655440015', NOW(), 'SAFE', '{"anxiety","presence","mental-health"}'),
  ('650e8400-e29b-41d4-a716-446655440016', 'broke up with someone who didn''t appreciate me and i''m actually thriving?? self-love looks different than i expected', '550e8400-e29b-41d4-a716-446655440007', NOW(), 'SAFE', '{"breakup","self-love","growth"}'),
  ('650e8400-e29b-41d4-a716-446655440017', 'if you''re going through something heavy right now, this is your sign that it won''t last forever. better days are coming i promise 🌟', '550e8400-e29b-41d4-a716-446655440004', NOW(), 'SAFE', '{"hope","encouragement","faith"}');

-- Create Comments
INSERT INTO comments (id, content, "postId", "userId", "createdAt", "moderationStatus") VALUES
  ('750e8400-e29b-41d4-a716-446655440001', 'I find that taking short walks really helps me manage stress.', '650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440004', NOW(), 'SAFE'),
  ('750e8400-e29b-41d4-a716-446655440002', 'That''s amazing progress! Keep it up 🌟', '650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', NOW(), 'SAFE'),
  ('750e8400-e29b-41d4-a716-446655440003', 'You''re never alone here. We''re all in this together.', '650e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440003', NOW(), 'SAFE'),
  ('750e8400-e29b-41d4-a716-446655440004', 'That''s a brave decision! Wishing you all the best with your journey.', '650e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440004', NOW(), 'SAFE'),
  ('750e8400-e29b-41d4-a716-446655440005', 'My habit is journaling for 10 minutes each morning. Really helps with clarity.', '650e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440005', NOW(), 'SAFE'),
  ('750e8400-e29b-41d4-a716-446655440006', 'Consistency is key! Even small commitments lead to big changes over time.', '650e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440006', NOW(), 'SAFE'),
  ('750e8400-e29b-41d4-a716-446655440007', 'Congratulations team! Grateful to be part of this amazing community.', '650e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440003', NOW(), 'SAFE'),
  ('750e8400-e29b-41d4-a716-446655440008', 'This space has been transformative. Thank you for creating it.', '650e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440001', NOW(), 'SAFE'),
  ('750e8400-e29b-41d4-a716-446655440009', 'fr fr no one talks about this enough. like what''s the timeline supposed to be??', '650e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440009', NOW(), 'SAFE'),
  ('750e8400-e29b-41d4-a716-446655440010', 'the pressure is so real. i''m learning to let go of expectations too', '650e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440015', NOW(), 'SAFE'),
  ('750e8400-e29b-41d4-a716-446655440011', 'this is so inspiring!! proud of you for doing the work 💚', '650e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440012', NOW(), 'SAFE'),
  ('750e8400-e29b-41d4-a716-446655440012', 'same journey fr. it''s scary but like worth it ya know', '650e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440008', NOW(), 'SAFE'),
  ('750e8400-e29b-41d4-a716-446655440013', 'social media really does that to us. comparing apples to oranges constantly 😭', '650e8400-e29b-41d4-a716-446655440009', '550e8400-e29b-41d4-a716-446655440007', NOW(), 'SAFE'),
  ('750e8400-e29b-41d4-a716-446655440014', 'i stopped posting as much lately and honestly my mental health improved', '650e8400-e29b-41d4-a716-446655440009', '550e8400-e29b-41d4-a716-446655440013', NOW(), 'SAFE'),
  ('750e8400-e29b-41d4-a716-446655440015', 'therapy changed my life too. so glad you''re being brave 💝', '650e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440011', NOW(), 'SAFE'),
  ('750e8400-e29b-41d4-a716-446655440016', 'healing is a journey not a destination. you got this 💪', '650e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440005', NOW(), 'SAFE'),
  ('750e8400-e29b-41d4-a716-446655440017', 'this!!! like why do we pretend everything is fine when we''re literally struggling', '650e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440007', NOW(), 'SAFE'),
  ('750e8400-e29b-41d4-a716-446655440018', 'asking for help is actually strength not weakness. took me a while to get that', '650e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440014', NOW(), 'SAFE'),
  ('750e8400-e29b-41d4-a716-446655440019', 'this community really is different. so thankful 🖤', '650e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440009', NOW(), 'SAFE'),
  ('750e8400-e29b-41d4-a716-446655440020', 'me too!! finally a space where i don''t have to mask', '650e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440015', NOW(), 'SAFE'),
  ('750e8400-e29b-41d4-a716-446655440021', 'needed this today so bad. thank you 💫', '650e8400-e29b-41d4-a716-446655440013', '550e8400-e29b-41d4-a716-446655440010', NOW(), 'SAFE'),
  ('750e8400-e29b-41d4-a716-446655440022', 'big mood. sending good energy back to you too 🌈', '650e8400-e29b-41d4-a716-446655440013', '550e8400-e29b-41d4-a716-446655440008', NOW(), 'SAFE'),
  ('750e8400-e29b-41d4-a716-446655440023', 'boundaries save lives fr. learning this late but better late than never', '650e8400-e29b-41d4-a716-446655440014', '550e8400-e29b-41d4-a716-446655440012', NOW(), 'SAFE'),
  ('750e8400-e29b-41d4-a716-446655440024', 'the relief i felt after setting boundaries?? unmatched 🙌', '650e8400-e29b-41d4-a716-446655440014', '550e8400-e29b-41d4-a716-446655440011', NOW(), 'SAFE'),
  ('750e8400-e29b-41d4-a716-446655440025', 'some days be like that. presence is an act of resistance for sure', '650e8400-e29b-41d4-a716-446655440015', '550e8400-e29b-41d4-a716-446655440013', NOW(), 'SAFE'),
  ('750e8400-e29b-41d4-a716-446655440026', 'the future is scary but like we''ll figure it out together maybe ✨', '650e8400-e29b-41d4-a716-446655440015', '550e8400-e29b-41d4-a716-446655440006', NOW(), 'SAFE'),
  ('750e8400-e29b-41d4-a716-446655440027', 'yes queen!! self-love era hits different 👑', '650e8400-e29b-41d4-a716-446655440016', '550e8400-e29b-41d4-a716-446655440012', NOW(), 'SAFE'),
  ('750e8400-e29b-41d4-a716-446655440028', 'so happy for you. you deserve someone who gets it', '650e8400-e29b-41d4-a716-446655440016', '550e8400-e29b-41d4-a716-446655440010', NOW(), 'SAFE'),
  ('750e8400-e29b-41d4-a716-446655440029', 'holding onto this hope. thank you for the reminder 💙', '650e8400-e29b-41d4-a716-446655440017', '550e8400-e29b-41d4-a716-446655440011', NOW(), 'SAFE'),
  ('750e8400-e29b-41d4-a716-446655440030', 'seasons change and pain doesn''t last. this resonates with me so much', '650e8400-e29b-41d4-a716-446655440017', '550e8400-e29b-41d4-a716-446655440008', NOW(), 'SAFE');
