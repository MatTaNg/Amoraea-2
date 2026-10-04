import { capProfilePhotoList, MAX_PROFILE_PHOTOS } from '../profilePhotoLimit';

describe('capProfilePhotoList', () => {
  it('drops blanks and duplicate URLs and keeps at most 6', () => {
    const photos = [
      ' https://cdn.example.com/1.jpg ',
      '',
      'https://cdn.example.com/1.jpg',
      'https://cdn.example.com/2.jpg',
      'https://cdn.example.com/3.jpg',
      'https://cdn.example.com/4.jpg',
      'https://cdn.example.com/5.jpg',
      'https://cdn.example.com/6.jpg',
      'https://cdn.example.com/7.jpg',
    ];

    expect(capProfilePhotoList(photos)).toEqual([
      'https://cdn.example.com/1.jpg',
      'https://cdn.example.com/2.jpg',
      'https://cdn.example.com/3.jpg',
      'https://cdn.example.com/4.jpg',
      'https://cdn.example.com/5.jpg',
      'https://cdn.example.com/6.jpg',
    ]);
    expect(MAX_PROFILE_PHOTOS).toBe(6);
  });
});
