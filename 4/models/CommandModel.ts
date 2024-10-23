// models/CommandModel.ts
import { DataTypes, Sequelize, Model, ModelCtor, Optional } from "sequelize";

export interface CommandAttributes {
    id?: number;
    name: string;
    response: string;
    createdAt?: Date;
    updatedAt?: Date;
}

interface CommandCreationAttributes extends Optional<CommandAttributes, "id"> {}

export class Command extends Model<
    CommandAttributes,
    CommandCreationAttributes
> {
    id!: number;
    name!: string;
    response!: string;
    createdAt!: Date;
    updatedAt!: Date;
}

export const defineCommandModel = (
    sequelize: Sequelize
): ModelCtor<Command> => {
    Command.init(
        {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
            },
            response: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            createdAt: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
            },
            updatedAt: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
            },
        },
        {
            sequelize,
            modelName: "Command",
            tableName: "Command",
        }
    );

    return Command;
};

Command.findOne = async function (this: ModelCtor<Command>, options?: any) {
    return Model.findOne.call(this, options);
};
