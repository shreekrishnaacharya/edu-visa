import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommonService } from '../../common/services/common.service';
import { StorageService } from '../../common/storage/storage.service';
import { StudentDocument } from './student-document.entity';

@Injectable()
export class DocumentService extends CommonService<StudentDocument> {
  constructor(
    @InjectRepository(StudentDocument) repo: Repository<StudentDocument>,
    private readonly storage: StorageService,
  ) {
    super(repo);
  }

  async upload(
    studentId: string,
    file: Express.Multer.File,
    docType: string,
    remark: string,
    uploadedBy: string,
  ): Promise<StudentDocument> {
    const key = this.storage.newKey(studentId, file.originalname);
    await this.storage.put(key, file.buffer, file.mimetype);
    return this.create({
      student_id: studentId,
      doc_type: docType,
      remark,
      uploaded_by: uploadedBy,
      file: {
        name: file.originalname,
        type: file.mimetype,
        size: file.size,
        storage_key: key,
      },
    } as Partial<StudentDocument>);
  }

  async withUrl(doc: StudentDocument) {
    return { ...doc, url: await this.storage.presignedGetUrl(doc.file.storage_key) };
  }

  async removeAndPurge(id: string) {
    const doc = await this.getOne(id);
    await this.storage.remove(doc.file.storage_key);
    return this.remove(id);
  }
}
