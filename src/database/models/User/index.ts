import { Model, Schema, Document } from "mongoose";
import { getLiterallyUserModel } from "../..";

export interface ILiterallyUser {
  id: string;
  specialGamesPlayedAt?: Date[];
}

export interface LiterallyUserModel extends Model<ILiterallyUser> {
  findOrCreate(
    user: ILiterallyUser,
  ): Promise<(ILiterallyUser & Document) | null>;
}

export const literallyUserSchema = new Schema<
  ILiterallyUser,
  LiterallyUserModel
>({
  id: { type: String, required: true },
  specialGamesPlayedAt: { type: [Date], required: false },
});

literallyUserSchema.static(
  "findOrCreate",
  async (
    user: Parameters<LiterallyUserModel["findOrCreate"]>[0],
  ): ReturnType<LiterallyUserModel["findOrCreate"]> => {
    const LiterallyUser = await getLiterallyUserModel();

    let foundUser = await LiterallyUser.findOne({ id: user.id }).catch((e) => {
      // eslint-disable-next-line no-console
      console.error(e);
      return null;
    });

    if (!foundUser) {
      foundUser = await LiterallyUser.create(user).catch((e) => {
        // eslint-disable-next-line no-console
        console.error(e);
        return null;
      });
    }

    return foundUser;
  },
);
