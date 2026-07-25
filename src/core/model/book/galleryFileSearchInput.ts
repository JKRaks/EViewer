import { R, type requestEncoding } from '../R'

export class gallerySimilaritySearchInput extends R {
  constructor(
    public file: File,
    public includeSimilar = true,
    public onlyCovers = false,
  ) {
    super()
  }

  url(): string {
    return '/image-lookup'
  }

  getMethod(): 'POST' {
    return 'POST'
  }

  getRequestEncoding(): requestEncoding {
    return 'multipart'
  }

  getRequestData(): FormData {
    const data = new FormData()
    data.append('sfile', this.file, this.file.name)
    data.append('f_sfile', 'File Search')
    if (this.includeSimilar) data.append('fs_similar', 'on')
    if (this.onlyCovers) data.append('fs_covers', 'on')
    return data
  }
}
